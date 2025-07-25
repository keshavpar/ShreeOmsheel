const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

mongoose.set('strictQuery', false);

const attendanceSchema = new mongoose.Schema({
    date: Date,
    status: { type: String, enum: ['present', 'absent'], default: 'present' },
    clockInTime: Date,
    clockOutTime: Date,
    remarks: String
}, { _id: false });

const dailyWorkSchema = new mongoose.Schema({
    task: String,
    completed: { type: Boolean, default: false },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: Date,
    date: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name!'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email!'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please enter a valid email!']
    },
    role: {
        type: String,
        enum: ['admin', 'staff', 'doctor'],
        default: 'staff'
    },
    password: {
        type: String,
        required: [true, 'Please enter a password!'],
        minlength: 8,
        select: false
    },
    confirmPassword: {
        type: String,
        required: [true, 'Please confirm your password!'],
        validate: {
            validator: function (val) {
                return val === this.password;
            },
            message: "Passwords do not match!"
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,

    aadhaarNumber: {
        type: String,
        required: [true, 'Aadhaar number is required!'],
        validate: {
            validator: function (val) {
                return /^\d{12}$/.test(val);
            },
            message: "Aadhaar number must be 12 digits"
        }
    },
    aadhaarCardUrl: {
        type: String, // S3 URL
        // required: [true, 'Aadhaar card image URL is required!']
    },

    attendance: [attendanceSchema],
    dailyWork: [dailyWorkSchema],

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password, 12);
    this.confirmPassword = undefined;
    next();
});

userSchema.methods.comparePasswordsinDB = async function (pswd, pswdDb) {
    return await bcrypt.compare(pswd, pswdDb);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
