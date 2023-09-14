const Patient = require('./../models/patients');

const CustomError = require('./../utils/customError');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');

exports.medExam = asyncErrorHandler( async (req, res, next) => { // List of all medical Exams of a patinet

    const patient = await Patient.findById(req.params.id);

    if(!patient){
        next (new CustomError(`No Patient found with this _id:${req.params.id}`));
    }

    res.status(200).json({
        status: "Success",
        data: {
            medicalExams: patient.medicalExams
        }
    });
})

exports.updateMedExams = asyncErrorHandler( async (req, res, next) => { // Adding medicalExams for a Patient

    const patient = await Patient.findByIdAndUpdate(req.body.id,
        {
            $push: {
                medicalExams: {
                    $each: req.body.medicalExams,
                },
            },
        },
        { new: true , runValidators: true }
    );
    
    if(!patient){
        const err = new CustomError(`No Patient found with this _id:${req.params.id}`);
        return next(err);
    }

    res.status(200).json({
        status: "Success",
        data: {
            patient
        }
    });
}) 