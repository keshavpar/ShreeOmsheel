const express = require('express');

const patientController = require('./../controllers/patientController');

const router = express.Router();

router.route('/patientnumber').get(patientController.countAllPatients);
router.route('/todaypat').get(patientController.todayPatientList);
router.route('/correct-city-state-typos').get(patientController.correctingCityStateTypos);
router.route('/patientlistpdf').get(patientController.patientListPdf);
router.route('/patientlist').get(patientController.patientList);
router.route('/addpatient').post(patientController.addPatient);
router.route('/delpatient/:id').delete(patientController.deletePatient);

module.exports = router;