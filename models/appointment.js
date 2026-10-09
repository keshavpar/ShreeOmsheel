const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    aadhaarNumber: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentTime: {
      type: String,
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
    addictionType: {
      type: String,
      required: false, // set to true if this is mandatory
      enum: [
        'Opium/Afeem',
        'Heroin',
        'Chitta',
        'Prescription Opioids',
        'Poppy/Bhukki/Doda',
        'Cannabis/Charas',
        'Multiple Substances'
      ], // optional: restrict to known types
    },
    message: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
