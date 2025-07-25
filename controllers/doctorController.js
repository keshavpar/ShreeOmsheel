const Doctor = require('../models/doctor');
const User = require('../models/user');
const asyncErrorHandler = require('../utils/asyncErrorHandler');
const CustomError = require('../utils/customError');

// ✅ Add Doctor (linked to a user)
exports.addDoctor = asyncErrorHandler(async (req, res, next) => {
  const { userId, registrationNo, board, degree, address, phone, aadhaarNumber, aadhaarImageUrl } = req.body;

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) return next(new CustomError('User not found', 404));

  // Check if doctor already exists for this user
  const existingDoctor = await Doctor.findOne({ user: userId });
  if (existingDoctor) return next(new CustomError('Doctor already exists for this user', 400));

  const doctor = await Doctor.create({
    user: userId,
    registrationNo,
    board,
    degree,
    address,
    phone,
    aadhaarNumber,
    aadhaarImageUrl
});

  res.status(201).json({ status: 'success', data: { doctor } });
});

// ✅ Get all Doctors
exports.getAllDoctors = asyncErrorHandler(async (req, res) => {
  const doctors = await Doctor.find().populate('user', 'name email role');
  res.status(200).json({ status: 'success', results: doctors.length, data: { doctors } });
});

// ✅ Get single doctor
exports.getDoctorById = asyncErrorHandler(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id).populate('user', 'name email role');
  if (!doctor) return next(new CustomError('Doctor not found', 404));
  res.status(200).json({ status: 'success', data: { doctor } });
});

// ✅ Update doctor
exports.updateDoctor = asyncErrorHandler(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!doctor) return next(new CustomError('Doctor not found', 404));
  res.status(200).json({ status: 'success', data: { doctor } });
});

// ✅ Delete doctor
exports.deleteDoctor = asyncErrorHandler(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) return next(new CustomError('Doctor not found', 404));
  res.status(204).json({ status: 'success', data: null });
});
