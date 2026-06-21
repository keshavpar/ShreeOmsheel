const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

router.post('/book-appointment', appointmentController.createAppointment);
router.get('/appointments', appointmentController.getAppointments);
router.delete('/appointments/:id', appointmentController.deleteAppointment);

module.exports = router;
