const express = require('express');

const medicalExamController = require('./../controllers/medicalExamController');

const router = express.Router();

router.route('/:id').get(medicalExamController.medExam).patch(medicalExamController.updateMedExams);

module.exports = router;