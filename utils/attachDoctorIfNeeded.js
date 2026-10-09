const Doctor = require('../models/doctor');

module.exports = async function attachDoctorIfNeeded(user) {
  if (user.role !== 'doctor') return null;

  const doctor = await Doctor.findOne({ user: user._id })
    .select('-__v')
    .lean();

  return doctor;
};
