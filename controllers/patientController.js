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
        ...r,
        signedUrl: r.url ? generateSignedUrl(r.url) : null,
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

// ─── List projection ──────────────────────────────────────────────────────────
// Excludes heavy embedded arrays (medicalExams, observations, reports,
// taperingStatus) — those are only fetched in getPatientById.
// Everything else including address, createdBy, affidavit etc. is included.
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
  blacklist:                  1,
  affidavitDocumentUrl:       1,
  patientPrescriptionCounter: 1,
  createdBy:                  1,
  lastModifiedBy:             1,
  createdAt:                  1,
  updatedAt:                  1,
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
  const patient = await Patient.findById(req.params.id).lean();

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

  // 🔍 Patient Lookup
  const patient = await Patient.findById(req.params.id);
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
    time,
  };

  patient.observations.push(newObservation);

  // 💾 Save
  await patient.save({ validateBeforeSave: false });
  const updatedCaps = calculateCapsules(patient);

  return res.status(200).json({
    status: 'success',
    data: {
      observations: patient.observations,
      capsuleStats: updatedCaps,
    },
  });
});
// PATCH /edit-observation/:patientId/:observationId
exports.editObservation = asyncErrorHandler(async (req, res, next) => {
  const { patientId, observationId } = req.params;
  const updatePayload = req.body;

  // 🔍 Fetch patient
  const patient = await Patient.findById(patientId);
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
  ];

  allowedFields.forEach((field) => {
    if (updatePayload[field] !== undefined) {
      observation[field] = updatePayload[field];
    }
  });

  // 💾 Save
  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: {
      observation,
    },
  });
});

// DELETE /delete-observation/:patientId/:observationId
exports.deleteObservation = asyncErrorHandler(async (req, res, next) => {
  const { patientId, observationId } = req.params;

  // 🔍 Fetch patient
  const patient = await Patient.findById(patientId);
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
  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    message: 'Observation deleted successfully',
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
  today.setHours(0, 0, 0, 0); // Start of today

  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1); // Start of next day

  const patients = await Patient.find({
    createdAt: { $gte: today, $lt: nextDay }
  });

  const formatted = attachSignedUrls(patients.map(p => p.toObject()));

  res.status(200).json({
    status: 'Success',
    data: { patients: formatted }
  });
});


// GET /signed-report-urls/:patientId
exports.getSignedUrlsForReports = asyncErrorHandler(async (req, res) => {
  const { patientId } = req.params;
  const patient = await Patient.findById(patientId);

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
exports.updatePatient = asyncErrorHandler(async (req, res, next) => {
  console.log('Updating patient with ID:', req.params.id);
  try {
    const updated = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(new CustomError('Patient not found', 404));
    }

    res.status(200).json({
      status: 'Success',
      data: { patient: attachSignedUrls([updated.toObject()])[0] },
    });
  } catch (err) {
    console.error('Error updating patient:', err);
    next(err);
  }
});
// PATCH /edit-medical-exam/:patientId/:examId
exports.editMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;
  const updatePayload = req.body;

  const patient = await Patient.findById(patientId);
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

  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: {
      medicalExam: exam,
    },
  });
});
// DELETE /delete-medical-exam/:patientId/:examId
exports.deleteMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;

  const patient = await Patient.findById(patientId);
  if (!patient) {
    return next(new CustomError('Patient not found', 404));
  }

  const exam = patient.medicalExams.id(examId);
  if (!exam) {
    return next(new CustomError('Medical exam not found', 404));
  }

  // 🗑 Remove exam (Mongoose 7+ safe)
  patient.medicalExams.pull({ _id: examId });

  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    message: 'Medical exam deleted successfully',
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

  if (![bp, pulse,  time].every(Boolean))
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
  const patient = await Patient.findById(req.params.id);
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
  await patient.save({ validateBeforeSave: false });

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
  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: {
      medicalExams: patient.medicalExams,
      capsuleStats: {
        dosage:       capsuleStats.dosage,
        expectedDate: capsuleStats.expectedDate,
        totalCaps:    capsuleStats.totalCaps,
        todayCaps:    capsuleStats.todayCaps,
      },
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

  const updated = await Patient.findByIdAndUpdate(
    id,
    { blacklist },
    { new: true, runValidators: true }
  );

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
  const patient = await Patient.findById(patientId);

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
  const deleted = await Patient.findByIdAndDelete(req.params.id);
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
// Body: { title: string, url: string }
// url is the S3 key (not a full URL) — signed URL is returned in response
exports.addReport = asyncErrorHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { title, url } = req.body;

  // 🔒 Validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    return next(new CustomError('Report title is required', 400));
  }
  if (!url || typeof url !== 'string' || !url.trim()) {
    return next(new CustomError('Report url (S3 key) is required', 400));
  }

  // 🔍 Patient lookup
  const patient = await Patient.findById(patientId);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 📎 Push new report
  patient.reports.push({ title: title.trim(), url: url.trim() });

  await patient.save({ validateBeforeSave: false });

  // Return all reports with fresh signed URLs
  const signedReports = await Promise.all(
    patient.reports.map(async (r) => ({
      title:     r.title,
      url:       r.url,
      signedUrl: await getSignedUrlPromise(r.url, 3600),
    }))
  );

  return res.status(201).json({
    status: 'success',
    message: 'Report added successfully',
    data: { reports: signedReports },
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
  const patient = await Patient.findById(patientId);
  if (!patient) return next(new CustomError('Patient not found', 404));

  // 🔍 Bounds check
  if (idx >= patient.reports.length) {
    return next(new CustomError('Report not found at given index', 404));
  }

  // 🗑 Remove by index — splice is safe since reports have no _id
  patient.reports.splice(idx, 1);

  await patient.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    message: 'Report deleted successfully',
    data: { reports: patient.reports },
  });
});