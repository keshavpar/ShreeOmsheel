const Patient = require('./../models/patients');
const Medicines = require('./../models/medicine');
const MedExams = require('./../models/doctor_examination');

const aysncErrorHandler = require('./../utils/asyncErrorHandler');
const CustomError = require('./../utils/customError');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');

exports.countAllPatients = aysncErrorHandler(async(req, res, next)=>{ // "/patientnumber"

    const count = await Patient.countDocuments({});

    res.status(200).json({
        status: "Success",
        data: {
            Count: count
        }
    });

})

//Get Today Patient List
exports.todayPatientList = aysncErrorHandler (async (req, res, next)=>{ // "/todaypat"

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to midnight
    // For Ex: Today is 23rd So all patients within Date : 23 - time: 12:00AM <=> Date: 24 - time: 12:00AM
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const todaysPatients = await Patient.find({ Date: { $gte: today, $lt: nextDay } })
        // .sort({ Date: -1 }); // For newest Patients at the top

    res.status(200).json({
        staus: "Success",
        Count: todaysPatients.length,
        Date: today.toISOString().split('T')[0],
        data: {
            patients: todaysPatients
        }
    });
})

exports.patientListPdf = aysncErrorHandler( async(req, res, next)=>{ // "/patientlistpdf"
    
    const patients = await Patient.find({}).select('-_id name address state Date phonenumber');
    
    res.status(200).json({
        status: "Success",
        Count: patients.length,
        data: {
            patients
        }
    });
})

//Getting the Patients list
exports.patientList = aysncErrorHandler( async(req, res, next)=>{ // "/patientlist"
    
    const patients = await Patient.find({})
        .sort({ Date: -1 }) // Sort by Date in descending order (most recent first)
        // select('-_id name address state Date phonenumber') // Specify the fields you want to include in the result
        // '-' before the field name means exclude 
    res.status(200).json({
        status: "Success",
        Count: patients.length,
        data: {
            patients
        }
    });
    
})

//Posting the patients 
exports.addPatient = aysncErrorHandler( async(req, res, next)=>{ // "/addpatient"

    const addpatient = await Patient.create(req.body);

    res.status(201).json({
        status: "Success",
        data: {
            addpatient
        }
    });

})

//Deleting the patient using id
exports.deletePatient = aysncErrorHandler( async(req, res, next)=>{  // "/delpatient/:id"
    
    const deletedPatient = await Patient.findById(req.params.id);

    if(!deletedPatient){
        const err = new CustomError(`Patient with _id:${req.params.id} is not found!`, 404);
        return next(err);
    }

    if(deletedPatient.medicalExams.length){
        const medExamIds = deletedPatient.medicalExams;
        
        await MedExams.deleteMany({_id: { $in: medExamIds } });
    }

    if (deletedPatient.medicinelist.length) {
        const medicineIds = deletedPatient.medicinelist;
    
        await Medicines.deleteMany({ _id: { $in: medicineIds } });
    }

    await Patient.deleteOne({_id: deletedPatient._id});

    res.status(204).json({
        status: "Success",
        data: null
    });  

})
