const Doctor = require('./../models/doctor');

const asyncErrorHandler = require('./../utils/asyncErrorHandler');
const CustomError = require('./../utils/customError');

exports.addDoctor = asyncErrorHandler(async (req, res, next) => {
    const doctor = await Doctor.create(req.body);

    res.status(201).json({
        status: 'success',
        data: {
            doctor
        }
    });
})

exports.doctorLists = asyncErrorHandler(async (req, res, next) => {
    const doctors = await Doctor.find();

    res.status(200).json({
        status: 'success',
        data: {
            doctors
        }
    });
})

exports.deleteDoctor = asyncErrorHandler(async (req, res, next) => {
    const doctor = await Doctor.findByIdAndDelete(req.params.id); // ( doctor/:id )

    if(!doctor) {
        return next(new CustomError("No doctor with id exists!", 400));
    }

    res.status(204).json({  // 204 -> No Content
        status: 'success',
        data: {}
    })
});

exports.updateDoctor = asyncErrorHandler(async (req, res, next) => {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true, validateBeforeSave: false});

    if(!doctor) {
        return next(new CustomError(`Doctor with _id:${req.params.id} didn't exists!`, 400));
    }

    res.status(200).json({
        status: 'success',
        data: {
            doctor
        }
    });
})