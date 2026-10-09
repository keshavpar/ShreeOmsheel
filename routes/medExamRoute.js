const express = require('express');
const medicalExamController = require('../controllers/medicalExamController');

const router = express.Router();

router.get('/:patientId', medicalExamController.getMedicalExams);

router.post('/:patientId', medicalExamController.addMedicalExam);

router.patch('/:patientId/:examId', medicalExamController.updateMedicalExam);

router.delete('/:patientId/:examId', medicalExamController.deleteMedicalExam);

module.exports = router;
