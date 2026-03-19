const express = require('express');
const patientController = require('./../controllers/patientController');

const router = express.Router();

// ─── Patient CRUD ──────────────────────────────────────────────────────────────
router.get('/patientlist',          patientController.getAllPatients);
router.get('/:id',                  patientController.getPatientById);
router.post('/add-patient',         patientController.createPatient);
router.patch('/edit-patient/:id',   patientController.updatePatient);
router.delete('/delpatient/:id',    patientController.deletePatient);

// ─── Patient stats ─────────────────────────────────────────────────────────────
router.get('/countpatients',        patientController.getPatientCount);
router.get('/todaypatients',        patientController.getTodayPatients);

// ─── Medical exam routes ───────────────────────────────────────────────────────
router.post('/add-medical-exam/:id',                          patientController.addMedicalExam);
router.patch('/edit-medical-exam/:patientId/:examId',         patientController.editMedicalExam);
router.delete('/delete-medical-exam/:patientId/:examId',      patientController.deleteMedicalExam);

// ─── Observation routes ────────────────────────────────────────────────────────
router.post('/add-observation/:id',                                   patientController.addObservation);
router.patch('/edit-observation/:patientId/:observationId',           patientController.editObservation);
router.delete('/delete-observation/:patientId/:observationId',        patientController.deleteObservation);

// ─── Report routes ─────────────────────────────────────────────────────────────
router.post('/add-report/:patientId',                 patientController.addReport);
router.patch('/update-report-url/:patientId/:reportIndex', patientController.updateReportUrl);
router.delete('/delete-report/:patientId/:reportIndex', patientController.deleteReport);
router.get('/signed-report-urls/:patientId',          patientController.getSignedUrlsForReports);

// ─── Blacklist ─────────────────────────────────────────────────────────────────
router.patch('/patients/:id/blacklist',               patientController.toggleBlacklist);

// ─── S3 signed URLs ────────────────────────────────────────────────────────────
router.get('/image-url/:patientId',                   patientController.getImageUrl);

// ─── Utility ───────────────────────────────────────────────────────────────────
router.patch('/correct-city-state',                   patientController.correctTypos);
router.get('/patientlist-pdf',                        patientController.getGroupedPatients);

module.exports = router;