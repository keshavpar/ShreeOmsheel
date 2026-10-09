const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.post('/add-doctor', doctorController.addDoctor);
router.get('/doctor-list', doctorController.getAllDoctors);
router.get('/doctor/:id', doctorController.getDoctorById);
router.patch('/doctor/:id', doctorController.updateDoctor);
router.delete('/doctor/:id', doctorController.deleteDoctor);

module.exports = router;
