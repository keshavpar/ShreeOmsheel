const mongoose = require('mongoose');
const validator = require('validator');

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true // 1-to-1 mapping with user account
    },

    registrationNo: {
      type: String,
      trim: true
    },

    board: {
      type: String,
      trim: true
    },

    degree: {
      type: String,
      trim: true
    },

    address: {
      type: String,
      trim: true
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[6-9]\d{9}$/.test(v); // Indian mobile validation
        },
        message: 'Invalid Indian phone number.'
      }
    },

    // ✅ Aadhaar number (12-digit, validated)
    aadhaarNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{12}$/.test(v);
        },
        message: 'Aadhaar number must be a 12-digit number.'
      },
      required: true,
      unique: true
    },

    // ✅ Aadhaar card photo (S3 key)
    aadhaarCardImageUrl: {
      type: String, // S3 key or full signed URL
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;
