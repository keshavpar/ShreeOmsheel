const Appointment = require('../models/appointment');
const asyncErrorHandler = require('../utils/asyncErrorHandler');
const CustomError = require('../utils/customError');

// POST /book-appointment
exports.createAppointment = asyncErrorHandler(async (req, res) => {
  const {
    fullName,
    email,
    phoneNumber,
    aadhaarNumber,
    appointmentDate,
    appointmentTime,
    service,
    message,
  } = req.body;

  if (
    !fullName ||
    !email ||
    !phoneNumber ||
    !aadhaarNumber ||
    !appointmentDate ||
    !appointmentTime ||
    !service
  ) {
    return res.status(400).json({ status: 'Error', message: 'Missing required fields' });
  }

  const appointment = await Appointment.create({
    fullName,
    email,
    phoneNumber,
    aadhaarNumber,
    appointmentDate,
    appointmentTime,
    service,
    message,
  });

  res.status(201).json({
    status: 'Success',
    message: 'Appointment booked successfully',
    data: { appointment },
  });
});

// GET /appointments
exports.getAppointments = asyncErrorHandler(async (req, res) => {
  const appointments = await Appointment.find().sort({ appointmentDate: 1 });
  res.status(200).json({ status: 'Success', data: { appointments } });
});

// DELETE /appointments/:id
exports.deleteAppointment = asyncErrorHandler(async (req, res, next) => {
  const deleted = await Appointment.findByIdAndDelete(req.params.id);
  if (!deleted) return next(new CustomError('Appointment not found', 404));
  res.status(204).json({ status: 'Success', data: null });
});
