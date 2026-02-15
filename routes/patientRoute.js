const express = require('express');

const patientController = require('./../controllers/patientController');

const router = express.Router();
router.get('/patientlist', patientController.getAllPatients);
router.get('/countpatients', patientController.getPatientCount);
router.get('/todaypatients', patientController.getTodayPatients);
router.post('/add-patient', patientController.createPatient);
router.post('/add-medical-exam/:id', patientController.addMedicalExam);
router.patch('/edit-patient/:id', patientController.updatePatient);
router.delete('/delpatient/:id', patientController.deletePatient);
router.patch('/patients/:id/blacklist', patientController.toggleBlacklist);
//Pending verification routes
router.get('/signed-report-urls/:patientId', patientController.getSignedUrlsForReports);
router.get('/image-url/:patientId', patientController.getImageUrl);

router.post('/add-observation/:id', patientController.addObservation);
router.patch('/edit-observation/:patientId/:observationId', patientController.editObservation);
router.delete('/delete-observation/:patientId/:observationId', patientController.deleteObservation);


//UNRELATED ROUTES
router.patch('/correct-city-state', patientController.correctTypos);
router.get('/patientlist-pdf', patientController.getGroupedPatients);
module.exports = router;