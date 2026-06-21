const Patient = require('../models/patients');
const CustomError = require('../utils/customError');
const asyncErrorHandler = require('../utils/asyncErrorHandler');
const { getSignedUrl, getSignedUrlPromise } = require('../utils/s3Utils');
const calculateCapsules = require('../utils/capsuleCalculator');

// Utility: Generate signed URL
const generateSignedUrl = (key, expiresInSeconds = 3600) => {
  return getSignedUrl(key, expiresInSeconds);
};

// Utility: Attach signed URLs
const attachSignedUrls = (patients) => {
  return patients.map((p) => {
    if (Array.isArray(p.reports)) {
      p.reports = p.reports.map((r) => ({
        title:      r.title,
        url:        r.url        ?? '',
        uploadedAt: r.uploadedAt ?? null,
        signedUrl:  r.url ? generateSignedUrl(r.url) : null,
      }));
    }
    if (p.affidavitDocumentUrl) {
      p.affidavitSignedUrl = generateSignedUrl(p.affidavitDocumentUrl);
    }
    if (p.imageUrl) {
      p.imageSignedUrl = generateSignedUrl(p.imageUrl);
    }
    return p;
  });
};

// ─── findPatientById ─────────────────────────────────────────────────────────
// Legacy documents (2022 era) were stored with _id as a plain string, not
// a MongoDB ObjectId. Patient.findById() casts to ObjectId automatically,
// which means it returns null for those old string _id documents.
// This utility tries ObjectId first, then falls back to string match —
// covering both old and new documents transparently.
const mongoose = require('mongoose');

const findPatientById = async (id, options = {}) => {
  const { lean = false } = options;

  // Step 1: Standard Mongoose lookup (works for ObjectId _id documents)
  let query = Patient.findById(id);
  if (lean) query = query.lean();
  let patient = await query;
  if (patient) return patient;

  // Step 2: Bypass Mongoose casting — use raw MongoDB driver for legacy string _id
  const rawDoc = await Patient.collection.findOne({ _id: id });
  if (!rawDoc) return null;

  if (lean) return rawDoc;

  // Hydrate into a Mongoose document so subdoc methods (.push, .id etc) work.
  // IMPORTANT: hydrate() casts _id back to ObjectId internally.
  // We store the original string _id on a non-schema property so safeSave
  // can detect legacy documents and bypass Mongoose's version check.
  const hydrated = Patient.hydrate(rawDoc);
  hydrated.__legacyStringId = String(id);
  return hydrated;
};


// ─── buildIdFilter ────────────────────────────────────────────────────────────
// For findOneAndUpdate / findOneAndDelete operations.
// Mongoose casts _id to ObjectId automatically — this bypasses that by using
// $or with both the ObjectId-cast version AND the raw string version,
// with casting disabled via the 'strict' option on the query.
// For legacy string _id documents, we must use the raw collection directly
// (see findPatientById). For update/delete we use $or as a best effort,
// but the raw string arm works because $or short-circuits on first match.
const buildIdFilter = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return {
      $or: [
        { _id: mongoose.Types.ObjectId.createFromHexString(id) },
        { _id: id },
      ],
    };
  }
  return { _id: id };
};

// ─── rawUpdatePatient / rawDeletePatient ──────────────────────────────────────
// For update and delete on legacy string _id documents, Mongoose casting
// makes $or unreliable. These use the raw MongoDB driver directly.
const rawFindOneAndUpdate = async (id, update, options = {}) => {
  // Try Mongoose first (works for ObjectId documents)
  const result = await Patient.findOneAndUpdate(
    buildIdFilter(id),
    update,
    { ...options, new: true, runValidators: true }
  );
  if (result) return result;

  // Fallback: raw driver for legacy string _id
  const raw = await Patient.collection.findOneAndUpdate(
    { _id: id },
    update,
    { returnDocument: 'after', ...options }
  );
  if (!raw) return null;
  return Patient.hydrate(raw);
};

const rawFindOneAndDelete = async (id) => {
  // Try Mongoose first
  const result = await Patient.findOneAndDelete(buildIdFilter(id));
  if (result) return result;

  // Fallback: raw driver for legacy string _id
  const raw = await Patient.collection.findOneAndDelete({ _id: id });
  return raw || null;
};

// ─── isLegacyId ──────────────────────────────────────────────────────────────
// Returns true if the _id is stored as a plain string (legacy 2022 documents).
// Mongoose hydrate() keeps the original string _id — we check its constructor.
const isLegacyId = (id) => {
  return typeof id === 'string' || id?.constructor?.name === 'String';
};

// ─── safeSave ─────────────────────────────────────────────────────────────────
// Mongoose .save() uses _id + __v for optimistic concurrency check.
// For legacy string _id documents this always fails because Mongoose casts
// the string _id to ObjectId in the version check query — matching nothing.
// We detect legacy documents upfront and skip .save() entirely,
// writing directly via the raw MongoDB driver instead.
const safeSave = async (patient) => {
  // __legacyStringId is set by findPatientById when a legacy string _id doc
  // is hydrated. Mongoose hydrate() casts _id to ObjectId internally,
  // so we cannot rely on _id type — we use this explicit marker instead.
  const legacyId = patient.__legacyStringId;

  if (legacyId) {
    // Legacy document — bypass Mongoose .save() entirely.
    // Mongoose version check uses ObjectId cast which misses the string _id.
    const modifiedObj = patient.toObject();
    const { _id, __v, createdAt, updatedAt, ...fieldsToUpdate } = modifiedObj;
    const result = await Patient.collection.updateOne(
      { _id: legacyId },
      { $set: fieldsToUpdate }
    );
    if (result.matchedCount === 0) {
      throw new Error(`safeSave: no document matched legacy _id "${legacyId}"`);
    }
  } else {
    // New document — standard Mongoose save
    await patient.save({ validateBeforeSave: false });
  }
};
// ─── List projection ──────────────────────────────────────────────────────────────────
// Excludes only heavy embedded arrays: medicalExams and observations.
// Everything else including reports, taperingStatus, address, createdBy etc. is included.
const PATIENT_LIST_PROJECTION = {
  name:                       1,
  age:                        1,
  gender:                     1,
  weight:                     1,
  image:                      1,
  aadharnumber:               1,
  phonenumber:                1,
  address:                    1,
  city:                       1,
  state:                      1,
  fathersname:                1,
  occupation:                 1,
  education:                  1,
  maritalstatus:              1,
  addictionperiod:            1,
  quantity:                   1,
  dosage:                     1,
  expectedDate:               1,
  totalcap:                   1,
  captoday:                   1,
  Startdosage:                1,
  lastVisitedDate:            1,
  taperingStatus:             1,
  blacklist:                  1,
  affidavitDocumentUrl:       1,
  patientPrescriptionCounter: 1,
  createdBy:                  1,
  lastModifiedBy:             1,
  createdAt:                  1,
  updatedAt:                  1,
  reports:                    1,
};

// GET /patientlist
// GET /patients?city=&doctor=&date=&page=&limit=&name=&aadharNumber=
exports.getAllPatients = asyncErrorHandler(async (req, res, next) => {
  const { city, doctor, date, page = 1, limit = 10, name, aadharNumber } = req.query;

  // ── Build filter ───────────────────────────────────────────────────────────
  const filter = {};

  if (city)   filter.city   = city.trim();
  if (doctor) filter.doctor = doctor.trim();

  // Validated date range filter
  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return next(new CustomError('Invalid date format. Use ISO 8601 e.g. 2026-03-12', 400));
    }
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    filter.createdAt = { $gte: d, $lt: nextDay };
  }

  // Aadhaar exact match
  if (aadharNumber) filter.aadharnumber = aadharNumber.trim();

  // Case-insensitive name search
  if (name) filter.name = { $regex: name.trim(), $options: 'i' };

  // ── Pagination — hard cap at 100 to prevent runaway queries ───────────────
  const pageNumber = Math.max(parseInt(page,  10) || 1, 1);
  const pageLimit  = Math.min(parseInt(limit, 10) || 10, 100);
  const skip       = (pageNumber - 1) * pageLimit;

  // ── Parallel fetch: data + total count in one round trip ──────────────────
  const [patients, totalCount] = await Promise.all([
    Patient.find(filter)
      .select(PATIENT_LIST_PROJECTION)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  // ── Attach signed URLs ─────────────────────────────────────────────────────
  const formatted = attachSignedUrls(patients);

  return res.status(200).json({
    status: 'success',
    data: { patients: formatted },
    pagination: {
      page:       pageNumber,
      limit:      pageLimit,
      count:      patients.length,
      totalCount,
      totalPages: Math.ceil(totalCount / pageLimit),
    },
  });
});

// GET /patient/:id  — full document for detail / profile page
exports.getPatientById = asyncErrorHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id, { lean: true });

  if (!patient) return next(new CustomError('Patient not found', 404));

  const formatted = attachSignedUrls([patient])[0];

  return res.status(200).json({
    status: 'success',
    data: { patient: formatted },
  });
});

// POST /add-observation/:id
exports.addObservation = asyncErrorHandler(async (req, res, next) => {
  const {
    doctor,
    bp,
    pulse,
    nadi,
    dosh,
    bal,
    jivha,
    findings,
    capgiven,
    soscap,
    time,
   
  } = req.body;

  // 🔒 Validation
  if (!doctor?.name || !doctor?._id) {
    return next(new CustomError('Invalid doctor data', 400));
  }

  if (
    ![bp, pulse, nadi, jivha].some(Boolean) && // allow partial vitals
    !findings
  ) {
    return next(new CustomError('At least vitals or findings must be provided', 400));
  }

  // 🔍 Patient Lookup — handles both ObjectId _id and legacy string _id documents
  const patient = await findPatientById(req.params.id);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  // 🧪 Compose observation (MATCHES ObservationSchema EXACTLY)
  const newObservation = {
    doctor,
    bp,
    pulse,
    nadi,
    dosh,
    bal,
    jivha,
    findings,
    capgiven,
    soscap,
    time,
  };

  patient.observations.push(newObservation);

  // 💾 Save
  await safeSave(patient);

  // ── Recompute and persist capsule totals ──────────────────────────────────
  // calculateCapsules sums capgiven across all observations + medicalExams.
  // todayCaps uses obs.time to determine if the entry is from today —
  // so only entries with time = today contribute to captoday.
  const capsuleStats = calculateCapsules(patient);
  patient.totalcap = capsuleStats.totalCaps;
  patient.captoday = capsuleStats.todayCaps;

  // 💾 Persist updated totalcap + captoday back to the document
  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    data: {
      observations: patient.observations,
      totalcap:     patient.totalcap,
      captoday:     patient.captoday,
    },
  });
});
// PATCH /edit-observation/:patientId/:observationId
exports.editObservation = asyncErrorHandler(async (req, res, next) => {
  const { patientId, observationId } = req.params;
  const updatePayload = req.body;

  // 🔍 Fetch patient
  const patient = await findPatientById(patientId);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  // 🔍 Find observation
  const observation = patient.observations.id(observationId);
  if (!observation) {
    return next(new CustomError('Observation not found', 404));
  }

  // 🧠 Update only allowed fields (no blind overwrite)
  const allowedFields = [
    'bp',
    'pulse',
    'nadi',
    'dosh',
    'bal',
    'jivha',
    'findings',
    'capgiven',
    'time',
    'doctor',
    'soscap'
  ];

  allowedFields.forEach((field) => {
    if (updatePayload[field] !== undefined) {
      observation[field] = updatePayload[field];
    }
  });

  // 💾 Save
  await safeSave(patient);

  // ── Recompute and persist capsule totals ──────────────────────────────────
  // capgiven or soscap may have changed — recalculate from scratch
  const editObsCaps = calculateCapsules(patient);
  patient.totalcap = editObsCaps.totalCaps;
  patient.captoday = editObsCaps.todayCaps;
  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    data: {
      observation,
      totalcap: patient.totalcap,
      captoday: patient.captoday,
    },
  });
});

// DELETE /delete-observation/:patientId/:observationId
exports.deleteObservation = asyncErrorHandler(async (req, res, next) => {
  const { patientId, observationId } = req.params;

  // 🔍 Fetch patient
  const patient = await findPatientById(patientId);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  // 🔍 Locate observation
  const observation = patient.observations.id(observationId);
  if (!observation) {
    return next(new CustomError('Observation not found', 404));
  }

  // 🗑 Remove observation (Mongoose 7+ safe)
  patient.observations.pull({ _id: observationId });

  // 💾 Save
  await safeSave(patient);

  // ── Recompute and persist capsule totals ──────────────────────────────────
  // Removing an observation reduces totalcap — recalculate from scratch
  const delObsCaps = calculateCapsules(patient);
  patient.totalcap = delObsCaps.totalCaps;
  patient.captoday = delObsCaps.todayCaps;
  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    message: 'Observation deleted successfully',
    data: {
      totalcap: patient.totalcap,
      captoday: patient.captoday,
    },
  });
});


// GET /countpatients
exports.getPatientCount = asyncErrorHandler(async (req, res) => {
  const count = await Patient.countDocuments();
  res.status(200).json({ status: 'Success', data: { count } });
});

// GET /todaypatients
exports.getTodayPatients = asyncErrorHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1);

  // Uses same projection as getAllPatients — excludes medicalExams and observations
  // which can be large. Full document is available via getPatientById.
  const patients = await Patient.find({
    createdAt: { $gte: today, $lt: nextDay }
  })
    .select(PATIENT_LIST_PROJECTION)
    .lean();

  const formatted = attachSignedUrls(patients);

  res.status(200).json({
    status: 'success',
    data: {
      patients: formatted,
      count: formatted.length,
    },
  });
});


// GET /signed-report-urls/:patientId
exports.getSignedUrlsForReports = asyncErrorHandler(async (req, res) => {
  const { patientId } = req.params;
  const patient = await findPatientById(patientId);

  if (!patient || !Array.isArray(patient.reports) || patient.reports.length === 0) {
    return res.status(404).json({ status: 'error', message: 'No reports found.' });
  }

  const signedReports = await Promise.all(
    patient.reports.map(async (r) => ({
      title: r.title,
      signedUrl: await getSignedUrlPromise(r.url, 300),
    }))
  );

  res.status(200).json({ status: 'success', data: signedReports });
});

// PATCH /edit-patient/:id
// ⚠️  CRITICAL: req.body is wrapped in $set — never passed raw.
// Passing req.body directly to findByIdAndUpdate WITHOUT $set causes MongoDB
// to treat it as a replacement document, wiping all fields not in the body.
// The allowlist below also prevents protected fields from being overwritten.
const PATIENT_UPDATE_ALLOWLIST = new Set([
  'name', 'age', 'gender', 'weight', 'address', 'city', 'state',
  'phonenumber', 'fathersname', 'occupation', 'education', 'maritalstatus',
  'addictionperiod', 'quantity', 'image', 'affidavitDocumentUrl',
  'dosage', 'expectedDate', 'Startdosage', 'lastModifiedBy',
]);

exports.updatePatient = asyncErrorHandler(async (req, res, next) => {
  // Strip any fields not in the allowlist — protects observations,
  // medicalExams, createdBy, blacklist, taperingStatus etc. from being
  // accidentally overwritten by the frontend.
  const safePayload = {};
  for (const [key, value] of Object.entries(req.body)) {
    if (PATIENT_UPDATE_ALLOWLIST.has(key)) {
      safePayload[key] = value;
    }
  }

  if (Object.keys(safePayload).length === 0) {
    return next(new CustomError('No valid fields provided for update', 400));
  }

  // $set ensures only provided fields are updated — all other fields are preserved
  // rawFindOneAndUpdate handles both ObjectId and legacy string _id documents
  const updated = await rawFindOneAndUpdate(req.params.id, { $set: safePayload });

  if (!updated) {
    return next(new CustomError('Patient not found', 404));
  }

  return res.status(200).json({
    status: 'success',
    data: { patient: attachSignedUrls([updated.toObject()])[0] },
  });
});
// PATCH /edit-medical-exam/:patientId/:examId
exports.editMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;
  const updatePayload = req.body;

  const patient = await findPatientById(patientId);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  const exam = patient.medicalExams.id(examId);
  if (!exam) {
    return next(new CustomError('Medical exam not found', 404));
  }

  // 🔒 Allowed fields ONLY
  const allowedFields = [
    'bp',
    'pulse',
    'nadi',
    'jivha',
    'time',
    'findings',
    'capgiven',
    'medicines',
    'tapering',
    'doctor',
  ];

  allowedFields.forEach((field) => {
    if (updatePayload[field] !== undefined) {
      exam[field] = updatePayload[field];
    }
  });

  await safeSave(patient);

  // ── Recompute and persist capsule totals ──────────────────────────────────
  // capgiven on the exam may have changed — recalculate from scratch
  const editExamCaps = calculateCapsules(patient);
  patient.totalcap = editExamCaps.totalCaps;
  patient.captoday = editExamCaps.todayCaps;
  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    data: {
      medicalExam: exam,
      totalcap:    patient.totalcap,
      captoday:    patient.captoday,
    },
  });
});
// DELETE /delete-medical-exam/:patientId/:examId
exports.deleteMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;

  const patient = await findPatientById(patientId);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  const exam = patient.medicalExams.id(examId);
  if (!exam) {
    return next(new CustomError('Medical exam not found', 404));
  }

  // 🗑 Remove exam (Mongoose 7+ safe)
  patient.medicalExams.pull({ _id: examId });

  await safeSave(patient);

  // ── Recompute and persist capsule totals ──────────────────────────────────
  // Removing an exam reduces totalcap — recalculate from scratch
  const delExamCaps = calculateCapsules(patient);
  patient.totalcap = delExamCaps.totalCaps;
  patient.captoday = delExamCaps.todayCaps;
  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    message: 'Medical exam deleted successfully',
    data: {
      totalcap: patient.totalcap,
      captoday: patient.captoday,
    },
  });
});

// POST /add-medical-exam/:id
exports.addMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const {
    doctor,
    bp,
    pulse,
    nadi,
    jivha,
    time,
    findings,
    capgiven,
    medicines,
    tapering = [], // default to empty array if not sent
  } = req.body;

  // 🔒 Strict Validation (Minimal + Fast)
  if (!doctor?.name || !doctor?._id)
    return next(new CustomError('Invalid doctor data', 400));

  if (![bp, pulse, nadi, time].every(Boolean))
    return next(new CustomError('Missing required fields', 400));

  if (!Array.isArray(medicines))
    return next(new CustomError('Medicines must be an array', 400));

  if (!Array.isArray(tapering))
    return next(new CustomError('Tapering must be an array', 400));

  // ✅ Validate tapering entries (fast, inline)
  for (const entry of tapering) {
    if (
      !entry.date ||
      typeof entry.morning !== 'number' ||
      typeof entry.evening !== 'number'
    ) {
      return next(new CustomError(
        'Invalid tapering entry. Each must contain date, morning, and evening as numbers.',
        400
      ));
    }
  }

  // 🔍 Patient Lookup
  const patient = await findPatientById(req.params.id);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 🧪 Compose medical exam
  const newExam = {
    doctor,
    bp,
    pulse,
    nadi,
    jivha,
    time,
    findings,
    capgiven,
    medicines,
    tapering,
  };

  patient.medicalExams.push(newExam);

  // 💾 Save exam first so the new exam gets its _id assigned by Mongoose
  await safeSave(patient);

  // ── Compute and persist tapering state ────────────────────────────────────
  // calculateCapsules reads the full medicalExams array (including the one
  // just pushed) and derives dosage + expectedDate from the active tapering.
  const capsuleStats = calculateCapsules(patient);

  // Locate the saved exam — it's the last one after push
  const savedExam = patient.medicalExams[patient.medicalExams.length - 1];

  // Build taperingStatus only if this exam has a valid tapering schedule
  const hasTapering = Array.isArray(tapering) && tapering.length >= 2;

  patient.dosage       = capsuleStats.dosage;
  patient.expectedDate = capsuleStats.expectedDate ?? patient.expectedDate;
  patient.totalcap     = capsuleStats.totalCaps;
  patient.captoday     = capsuleStats.todayCaps;
  patient.patientPrescriptionCounter += 1;

  if (hasTapering) {
    patient.taperingStatus = {
      examId:      savedExam._id,
      stepIndex:   0,
      isCompleted: false,
    };
  }

  // 💾 Persist computed fields — single additional save
  await safeSave(patient);

  // All capsule/taper data is now persisted on the patient document.
  // Return the patient-level fields directly — no separate capsuleStats object.
  return res.status(200).json({
    status: 'success',
    data: {
      medicalExams:               patient.medicalExams,
      dosage:                     patient.dosage,
      expectedDate:               patient.expectedDate,
      totalcap:                   patient.totalcap,
      captoday:                   patient.captoday,
      taperingStatus:             patient.taperingStatus,
      patientPrescriptionCounter: patient.patientPrescriptionCounter,
    },
  });
});


// PATCH /patients/:id/blacklist
exports.toggleBlacklist = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const { blacklist } = req.body;

  if (typeof blacklist !== 'boolean') {
    return next(new CustomError('Invalid value for blacklist; must be boolean.', 400));
  }

  // rawFindOneAndUpdate handles both ObjectId and legacy string _id documents
  const updated = await rawFindOneAndUpdate(id, { $set: { blacklist } });

  if (!updated) {
    return next(new CustomError('Patient not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `Patient has been ${blacklist ? 'blacklisted' : 'unblacklisted'}`,
    data: { patient: attachSignedUrls([updated.toObject()])[0] }
  });
});

// GET /patientlist-pdf
exports.getGroupedPatients = asyncErrorHandler(async (req, res) => {
  const grouped = await Patient.aggregate([
    {
      $group: {
        _id: {
          city: { $toLower: { $trim: { input: '$city' } } },
          state: { $toLower: { $trim: { input: '$state' } } },
        },
        patients: { $push: '$$ROOT' },
        count: { $sum: 1 },
      },
    },
  ]);

  grouped.forEach(g => {
    g.patients = attachSignedUrls(g.patients.map(p => p.toObject()));
  });

  res.status(200).json({
    status: 'Success',
    count: grouped.length,
    data: grouped,
  });
});

// GET /image-url/:patientId
exports.getImageUrl = asyncErrorHandler(async (req, res) => {
  const { patientId } = req.params;
  const patient = await findPatientById(patientId);

  if (!patient || !patient.imageUrl) {
    return res.status(404).json({ status: 'error', message: 'Image not found' });
  }

  const signedUrl = await getSignedUrlPromise(patient.imageUrl, 300);

  res.status(200).json({ status: 'success', data: { signedImageUrl: signedUrl } });
});

// POST /add-patient
const isValidAadhaar = (value) => {
  return /^\d{12}$/.test(String(value));
};

exports.createPatient = asyncErrorHandler(async (req, res) => {
  const payload = req.body;

  if (!payload?.aadharnumber) {
    return res.status(400).json({
      status: 'fail',
      message: 'Aadhaar number is required.',
    });
  }

  if (!isValidAadhaar(payload.aadharnumber)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Aadhaar number must be exactly 12 numeric digits.',
    });
  }

  const existingPatient = await Patient.findOne({
    aadharnumber: payload.aadharnumber,
  }).lean();

  if (existingPatient) {

    // 🔴 BLACKLIST — HARD BLOCK
    if (existingPatient.blacklist) {
      return res.status(403).json({
        status: 'fail',
        message: 'This patient is blacklisted.',
        flags: {
          blacklisted: true,
          hasAffidavit: !!existingPatient.affidavitDocumentUrl,
        },
        data: {
          patientId: existingPatient._id,
        },
      });
    }

    // 🟠 DUPLICATE — INFORM FRONTEND ABOUT AFFIDAVIT
    return res.status(409).json({
      status: 'fail',
      message: 'Patient with this Aadhaar number already exists.',
      flags: {
        blacklisted: false,
        hasAffidavit: !!existingPatient.affidavitDocumentUrl,
      },
      data: {
        patientId: existingPatient._id,
        createdAt: existingPatient.createdAt,
      },
    });
  }

  const newPatient = await Patient.create(payload);

  const formattedPatient = attachSignedUrls([
    newPatient.toObject(),
  ])[0];

  return res.status(201).json({
    status: 'success',
    message: 'Patient created successfully.',
    flags: {
      blacklisted: newPatient.blacklist,
      hasAffidavit: !!newPatient.affidavitDocumentUrl,
    },
    data: {
      patient: formattedPatient,
    },
  });
});


// DELETE /delpatient/:id
exports.deletePatient = asyncErrorHandler(async (req, res, next) => {
  // rawFindOneAndDelete handles both ObjectId and legacy string _id documents
  const deleted = await rawFindOneAndDelete(req.params.id);
  if (!deleted) return next(new CustomError('Patient not found', 404));
  res.status(204).json({ status: 'Success', data: null });
});

// PATCH /correct-city-state
exports.correctTypos = asyncErrorHandler(async (req, res) => {
  const cityFixes = { hanumangrah: 'hanumangarh', Hanumangrah: 'hanumangarh' };
  const stateFixes = { Haryan: 'Haryana', raasthan: 'Rajasthan' };

  for (const [wrong, right] of Object.entries(cityFixes)) {
    await Patient.updateMany({ city: wrong }, { $set: { city: right } });
  }

  for (const [wrong, right] of Object.entries(stateFixes)) {
    await Patient.updateMany({ state: wrong }, { $set: { state: right } });
  }

  res.status(200).json({ status: 'success', message: 'City and state typos fixed' });
});

// ─── Reports ──────────────────────────────────────────────────────────────────

// POST /add-report/:patientId
// Step 1 of 2 — Doctor creates report with title only.
// Lab technician uploads file and patches url separately via updateReportUrl.
// Body: { title: string, url?: string }
exports.addReport = asyncErrorHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { title, url } = req.body;

  // 🔒 Validation — title required, url optional at this stage
  if (!title || typeof title !== 'string' || !title.trim()) {
    return next(new CustomError('Report title is required', 400));
  }

  // 🔍 Patient lookup
  const patient = await findPatientById(patientId);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 📎 Push new report — url defaults to '' if not provided
  patient.reports.push({
    title:      title.trim(),
    url:        url ? url.trim() : '',
    uploadedAt: url ? new Date() : null,
  });

  await safeSave(patient);

  return res.status(201).json({
    status: 'success',
    message: 'Report created successfully',
    data: {
      reports:     patient.reports,
      reportIndex: patient.reports.length - 1, // index to use for updateReportUrl
    },
  });
});

// PATCH /update-report-url/:patientId/:reportIndex
// Step 2 of 2 — Lab technician uploads file and patches the url.
// Body: { url: string }  (S3 key)
exports.updateReportUrl = asyncErrorHandler(async (req, res, next) => {
  const { patientId, reportIndex } = req.params;
  const { url } = req.body;
  const idx = parseInt(reportIndex, 10);

  // 🔒 Validation
  if (isNaN(idx) || idx < 0) {
    return next(new CustomError('Invalid report index', 400));
  }
  if (!url || typeof url !== 'string' || !url.trim()) {
    return next(new CustomError('Report url (S3 key) is required', 400));
  }

  // 🔍 Patient lookup
  const patient = await findPatientById(patientId);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 🔍 Bounds check
  if (idx >= patient.reports.length) {
    return next(new CustomError('Report not found at given index', 404));
  }

  // 🔗 Patch url and set uploadedAt timestamp
  patient.reports[idx].url        = url.trim();
  patient.reports[idx].uploadedAt = new Date();

  await safeSave(patient);

  // Return signed URL for immediate use
  const signedUrl = await getSignedUrlPromise(url.trim(), 3600);

  // patient.reports[idx] may be a plain object (legacy doc) or Mongoose subdoc.
  // Normalise to plain object before spreading — toObject() is not guaranteed.
  const reportObj = typeof patient.reports[idx].toObject === 'function'
    ? patient.reports[idx].toObject()
    : { ...patient.reports[idx] };

  return res.status(200).json({
    status: 'success',
    message: 'Report url updated successfully',
    data: {
      report: {
        ...reportObj,
        signedUrl,
      },
    },
  });
});

// DELETE /delete-report/:patientId/:reportIndex
// Reports use ReportSchema with { _id: false } so they have no _id.
// We identify them by their index in the array — passed as a URL param.
exports.deleteReport = asyncErrorHandler(async (req, res, next) => {
  const { patientId, reportIndex } = req.params;
  const idx = parseInt(reportIndex, 10);

  // 🔒 Validate index
  if (isNaN(idx) || idx < 0) {
    return next(new CustomError('Invalid report index', 400));
  }

  // 🔍 Patient lookup
  const patient = await findPatientById(patientId);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 🔍 Bounds check
  if (idx >= patient.reports.length) {
    return next(new CustomError('Report not found at given index', 404));
  }

  // 🗑 Remove by index — splice is safe since reports have no _id
  patient.reports.splice(idx, 1);

  await safeSave(patient);

  return res.status(200).json({
    status: 'success',
    message: 'Report deleted successfully',
    data: { reports: patient.reports },
  });
});