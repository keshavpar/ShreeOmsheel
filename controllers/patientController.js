const Patient = require('./../models/patients');

const CustomError = require('./../utils/customError');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');

exports.countAllPatients = asyncErrorHandler(async(req, res, next)=>{ // "/patientnumber"

    const count = await Patient.countDocuments({});

    res.status(200).json({
        status: "Success",
        data: {
            Count: count
        }
    });

})

//Get Today Patient List
exports.todayPatientList = asyncErrorHandler (async (req, res, next)=>{ // "/todaypat"

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to midnight
    // For Ex: Today is 23rd So all patients within Date : 23 - time: 12:00AM <=> Date: 24 - time: 12:00AM
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const todaysPatients = await Patient.find({ Date: { $gte: today, $lt: nextDay } })
        // .sort({ Date: -1 }); // For newest Patients at the top

    res.status(200).json({
        staus: "Success",
        // Count: todaysPatients.length,
        // Date: today.toISOString().split('T')[0],
        data: {
            patients: todaysPatients
        }
    });
})

exports.patientListPdf = asyncErrorHandler( async(req, res, next)=>{ // "/patientlistpdf"
    
    const cityMappings = {
        "hanumangrah": "hanumangarh",
        "Hanumangrah": "hanumangarh",
        "fatehbad": "fatehabad",
        "Fatehbad": "fatehabad",
        "Gangangar":"Ganganagar",
        "Ganagangar":"Ganganagar",
        "Bhatinda":"Bhathinda",
        "Hanuangarh":"Hanumangarh",
        "hamunngrah":"Hanumangarh"
        // Add more mappings as needed
    };
    const stateMappings={
        "Haryan":"Haryana",
        "Harayana":"Haryana",
        "raasthan":"Rajasthan",
        "hryana":"Haryana",
        "haryan":"Haryana",
        "Rjasthan":"Rajasthan"
        }
    for (const incorrectCity in cityMappings) {
        const correctCity = cityMappings[incorrectCity];
    
        // Update documents with incorrect city name to use the correct city name
        await Patient.updateMany({ city: incorrectCity }, { $set: { city: correctCity } });
    }
    for (const incorrectState in stateMappings) {
        const correctState = stateMappings[incorrectState];
    
        // Update documents with incorrect city name to use the correct city name
        await Patient.updateMany({ state: incorrectState }, { $set: { state: correctState } });
    }
        // Similarly make the State mappings and update it ¯\_(ツ)_/¯

        const StateMappings = {
            "haryan": "haryana",
            "Haryan": "haryana",
            "harayana": "haryana",
            "Harayana": "haryana",
            "rajsthan": "rajasthan",
            "Rajsthan": "rajasthan",
            "Rajasthanq": "rajasthan"
            // Add more mappings as needed
        };
        
        for (const incorrectState in StateMappings) {
            const correctState = StateMappings[incorrectState];
        
            // Update documents with incorrect state name to use the correct state name
            await Patient.updateMany({ state: incorrectState }, { $set: { state: correctState } });
        }


    const patients = await Patient.aggregate([
        {
            $group: { 
                _id: { // Still some typos 'Fatehbad' and 'Fatehabad' will be different 
                    city: { $toLower: { $trim: { input: '$city' } } },// 'Haryana' <=> 'haryana' (so first lowercase all)
                    state: { $toLower: { $trim: { input: '$state' } } },// 'Harayana' <=> 'Harayana_' (trim the extra space)
                },
                patients: {
                    $push: {
                        name: '$name',
                        fathersname: '$fathersname',
                        phonenumber: '$phonenumber',
                        aadharnumber: '$aadharnumber',
                        Date: '$Date',
                        address: '$address',
                        state: '$state',
                        city: '$city',
                    }
                },
                count: { $sum: 1 }
            }
        }
    ]);
    
    res.status(200).json({
        status: "Success",
        Count: patients.length,
        data: {
            patients
        }
    });
})

//Getting the Patients list
exports.patientList = asyncErrorHandler( async(req, res, next)=>{ // "/patientlist"
    
    const patients = await Patient.find({})
        .sort({ Date: -1 }) // Sort by Date in descending order (most recent first)
        // select('-_id name address state Date phonenumber') // Specify the fields you want to include in the result
        // '-' before the field name means exclude 
    res.status(200).json({
        status: "Success",
        // Count: patients.length,
        data: {
            patients
        }
    });
    
})

//Posting the patients 
exports.addPatient = asyncErrorHandler( async(req, res, next)=>{ // "/addpatient"

    const addpatient = await Patient.create(req.body);

    res.status(201).json({
        status: "Success",
        data: {
            addpatient
        }
    });

})

//Deleting the patient using id
exports.deletePatient = asyncErrorHandler( async(req, res, next)=>{  // "/delpatient/:id"
    
    let deletedPatient = await Patient.findByIdAndDelete(req.params.id);

    if(!deletedPatient){
        const err = new CustomError(`Patient with _id:${req.params.id} is not found!`, 404);
        return next(err);
    }

    res.status(204).json({
        status: "Success",
        data: null
    });  

})
