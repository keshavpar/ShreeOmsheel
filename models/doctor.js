const mongoose = require('mongoose');

// name; registration No.; BOARD; Degree; Address; PhoneNumber
const doctorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter the Doctor name']
    },
    registration_No: {
        type: String,
        default: ''
    },
    board: {
        type: String,
        default: ''
    },
    degree: {
        type: String,
        default: '',
    },
    Address: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    }
});

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;