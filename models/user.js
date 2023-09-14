const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name! '],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email! '],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please enter your valid email! ']
    },
    role: {
        type: String,
        enum: ['admin', 'staff', 'doctor'],
        default: 'staff'
    },
    password: {
        type: String,
        required: [true, 'Please enter a password! '],
        minlength: 8,
        select: false
    },
    confirmPassword: {
        type: String,
        required: [true, 'Please confirm your password!'],
        validate: {
            // works with save and create, not with update
            validator: function(val) {
                return val === this.password
            },
            message: "Password and confirm-passworddoesn't match"
        }
    }
    
})

