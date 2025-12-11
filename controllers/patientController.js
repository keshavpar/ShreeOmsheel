const Patient = require('../models/patients');
const CustomError = require('../utils/customError');
const asyncErrorHandler = require('../utils/asyncErrorHandler');
const { getSignedUrl, getSignedUrlPromise } = require('../utils/s3Utils');

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

// GET /patientlist
// GET /patients?city=&doctor=&date=&page=&limit=
exports.getAllPatients = asyncErrorHandler(async (req, res) => {
  const { city, doctor, date, page = 1, limit = 10, name, aadharNumber } = req.query;

  // Base filter object
  const filter = {};

  // Filter by city
  if (city) filter.city = city;

  // Filter by doctor
  if (doctor) filter.doctor = doctor;

  // Filter by exact date (00:00 to 23:59 range)
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);

    filter.createdAt = { $gte: d, $lt: nextDay };
  }

  // Search by Aadhaar Number (Exact match)
  if (aadharNumber) {
    filter.aadharnumber = aadharNumber.trim();
  }

  // Search by Name (Case-insensitive partial match)
  if (name) {
    filter.name = { $regex: name.trim(), $options: 'i' }; 
  }

  // Pagination variables
  const pageNumber = parseInt(page, 10) || 1;
  const pageLimit = parseInt(limit, 10) || 10;

  // Fetch patients
  const patients = await Patient.find(filter)
    .sort({ createdAt: -1 }) // Most recent first
    .skip((pageNumber - 1) * pageLimit)
    .limit(pageLimit)
    .lean();

  // Attach signed URLs (if any media exists)
  const formatted = attachSignedUrls(patients);

  // Return response
  res.status(200).json({
    status: 'Success',
    data: { patients: formatted },
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      count: patients.length
    }
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
// POST /add-medical-exam/:id
exports.addMedicalExam = async (req, res, next) => {
  try {
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
      tapering = [] // default to empty array if not sent
    } = req.body;

    // 🔒 Strict Validation (Minimal + Fast)
    if (!doctor?.name || !doctor?._id)
      return res.status(400).json({ status: 'Error', message: 'Invalid doctor data' });

    if (![bp, pulse, nadi, jivha, time, findings].every(Boolean))
      return res.status(400).json({ status: 'Error', message: 'Missing required fields' });

    if (!Array.isArray(medicines))
      return res.status(400).json({ status: 'Error', message: 'Medicines must be an array' });

    if (!Array.isArray(tapering))
      return res.status(400).json({ status: 'Error', message: 'Tapering must be an array' });

    // ✅ Optionally: Validate tapering entries (fast, inline)
    for (const entry of tapering) {
      if (
        !entry.date ||
        typeof entry.morning !== 'number' ||
        typeof entry.evening !== 'number'
      ) {
        return res.status(400).json({
          status: 'Error',
          message: 'Invalid tapering entry. Each must contain date, morning, and evening as numbers.',
        });
      }
    }

    // 🔍 Patient Lookup (lean for performance)
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ status: 'Error', message: 'Patient not found' });

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

    // 💾 Save (skip validation for speed if confident: `validateBeforeSave: false`)
    await patient.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: 'Success',
      data: { medicalExams: patient.medicalExams },
    });
  } catch (err) {
    console.error('Error adding medical exam:', err);
    return res.status(500).json({ status: 'Error', message: 'Internal server error' });
  }
};


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
exports.createPatient = asyncErrorHandler(async (req, res, next) => {
  const payload = req.body;

  if (!payload?.aadharnumber) {
    return res.status(400).json({
      status: "fail",
      message: "Aadhar number is required."
    });
  }

  if (String(payload.aadharnumber).length !== 12) {
    return res.status(400).json({
      status: "fail",
      message: "Aadhar number must be exactly 12 digits."
    });
  }

  // 🔥 1. DUPLICATE CHECK BEFORE INSERT
  const existing = await Patient.findOne({ aadharnumber: payload.aadharnumber });

  if (existing) {
    return res.status(409).json({
      status: "fail",
      message: "Patient with this Aadhar number already exists.",
      existingPatientId: existing._id,
    });
  }

  try {
    // 🔥 2. CREATE PATIENT
    const patient = await Patient.create(payload);

    // 🔥 3. ADD SIGNED URLS IF NEEDED
    const response = attachSignedUrls([patient.toObject()])[0];

    return res.status(200).json({
      status: "success",
      message: "Patient created successfully.",
      data: { patient: response },
    });
  } catch (err) {
    console.error("❌ Patient creation error:", err);

    // 🔥 4. HANDLE MONGODB DUPLICATE ERROR (11000) AS WELL
    if (err.code === 11000) {
      return res.status(409).json({
        status: "fail",
        message: "Duplicate entry. Aadhar number must be unique.",
        keyValue: err.keyValue
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error while creating patient."
    });
  }
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
