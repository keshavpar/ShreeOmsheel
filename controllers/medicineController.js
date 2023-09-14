const Patient = require('./../models/patients');

const CustomError = require('./../utils/customError');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');

exports.medicines = asyncErrorHandler( async (req, res, next) => { // List of Medicines of a Patient
    const patient = await Patient.findById(req.params.id);

    if(!patient){
        next (new CustomError(`No Patient found with this _id:${req.params.id}`));
    }

    res.status(200).json({
        status: "Success",
        data: {
            medicines: patient.medicinelist
        }
    });
})


exports.updateMeds = asyncErrorHandler( async (req, res, next) => { // Adding More Medicines for a Patient

    const patient = await Patient.findByIdAndUpdate(req.body.id,
        {
            $push: {
                medicinelist: {
                    $each: req.body.medicinelist,
                },
            },
        },
        { new: true, runValidators: true }
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


//Length of medicine
// app.get("/medicinenumber",async(req,res)=>{
//     try{
//         var query = medicine.find();
//         query.count(function(err,count){
//           res.json({data:count})

//         });
//     }
//     catch(err){
//         res.status(500).json({data:[],error:err})
//     }
// })



/* ************************************************************************************** */
// list of Number of all medicines ? 
// [ Qt0, Qt1, ...]

// OR

// Sum of all quantities of medicines 
// [ Qt0 + Qt1 + ... ]

// OR

// Quantity of only specific medicine ( Qti )

// OR

// Total Number of Unique Medicines ( No_Of_Meds: patient.medicinelist.length )
/* *************************************************************************************** */



