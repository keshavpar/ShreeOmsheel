const Patient = require('../models/patients');
const CustomError = require('../utils/customError');
const asyncErrorHandler = require('../utils/asyncErrorHandler');

// ---------------------------------------------
// GET all medical exams for a patient
// ---------------------------------------------
exports.getMedicalExams = asyncErrorHandler(async (req, res, next) => {
  const { patientId } = req.params;

  const patient = await Patient.findById(patientId).lean();

  if (!patient) {
    return next(new CustomError(`Patient not found: ${patientId}`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: patient.medicalExams || []
  });
});

// ---------------------------------------------
// ADD a new medical exam
// (client MUST send examDate; nothing on server overrides it)
// ---------------------------------------------
exports.addMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId } = req.params;

  const examData = req.body;

  if (!examData || typeof examData !== "object") {
    return next(new CustomError("Invalid exam data.", 400));
  }

  // Hard validation: client must send date
  if (!examData.examDate) {
    return next(new CustomError("examDate is required. Server will not auto-generate it.", 400));
  }

  const patient = await Patient.findByIdAndUpdate(
    patientId,
    { $push: { medicalExams: examData } },
    { new: true, runValidators: true }
  );

  if (!patient) {
    return next(new CustomError(`Patient not found: ${patientId}`, 404));
  }

  return res.status(201).json({
    status: "success",
    message: "Medical exam added successfully.",
    data: patient.medicalExams
  });
});

// ---------------------------------------------
// UPDATE a specific medical exam
// ---------------------------------------------
exports.updateMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;
  const updates = req.body;

  if (!updates || typeof updates !== "object") {
    return next(new CustomError("Invalid update payload.", 400));
  }

  // Hard rule: date must come from client
  if (updates.examDate === undefined) {
    return next(new CustomError("examDate is required for updating an exam.", 400));
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: patientId, "medicalExams._id": examId },
    {
      $set: {
        "medicalExams.$.examDate": updates.examDate,
        "medicalExams.$.pulse": updates.pulse,
        "medicalExams.$.bloodPressure": updates.bloodPressure,
        "medicalExams.$.nadi": updates.nadi,
        "medicalExams.$.tongue": updates.tongue,
        "medicalExams.$.other": updates.other,
        // add any other fields your schema supports
      }
    },
    { new: true, runValidators: true }
  );

  if (!patient) {
    return next(new CustomError(`Medical exam not found for update: ${examId}`, 404));
  }

  const updatedExam = patient.medicalExams.find(exam => exam._id.toString() === examId);

  return res.status(200).json({
    status: "success",
    message: "Medical exam updated successfully.",
    data: updatedExam
  });
});

// ---------------------------------------------
// DELETE a specific medical exam
// ---------------------------------------------
exports.deleteMedicalExam = asyncErrorHandler(async (req, res, next) => {
  const { patientId, examId } = req.params;

  if (!patientId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new CustomError("Invalid patient ID format.", 400));
  }

  if (!examId.match(/^[0-9a-fA-F]{24}$/)) {
    return next(new CustomError("Invalid exam ID format.", 400));
  }

  const exists = await Patient.findOne(
    { _id: patientId, "medicalExams._id": examId },
    { _id: 1 }
  ).lean();

  if (!exists) {
    return next(new CustomError(
      `Exam ${examId} not found for patient ${patientId}`, 
      404
    ));
  }

  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $pull: { medicalExams: { _id: examId } } },
    { new: true }
  );

  return res.status(200).json({
    status: "success",
    message: "Medical exam deleted successfully.",
    deletedExamId: examId
  });
});
