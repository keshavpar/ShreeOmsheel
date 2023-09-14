//models
const medicine= require("./models/medicine")
const patient  = require("./models/patients")
const bill = require("./models/Bill")
const sale = require("./models/sale")
const MedicalExamination = require("./models/doctor_examination");

/*
$$$$$$$$$$$$$$$$$$$$$$$$ More to IMPLEMENT $$$$$$$$$$$$$$$$$$$$$$$$$$$$$
************************************************************************

(1) Adding Patient (Without any medExms or meds) After adding Patient,
    need to add more new meds or add more medExms

(2) Increment or Decrement the Quantity of a particular Medicine of particular patient

(3) Add or delete some medicines or medExms of a particular patient

(All the above will be easy to implement if we embed the documents instead of referencing with different collections)

(4) Adding Search Functionality acc to locations (can be done with Aggregation Pipeline)

(5) Fetch and search list of patients on given date, month and year
    ( 
        From frontend embed the date, month and year parameter into url's query part so we can get it
        here from req.params.date, req.params.month, req.params.year
    )

(6) Search list of patients with group by state or city
        a) Only State (State)
        b) State with City ( two state may have same name of city ) (State & City)

************************************************************************
*/




//Updating the Bill values
app.patch('/patientsbillupdate/:id',async(req,res,next)=>{
    try{
        const _id=req.params.id;
        const updates=req.body;
        const options={new:true}
        const result = await patient.findByIdAndUpdate(_id,updates,options)
        result.save()
        res.send(result);
    }
    catch(error){
        console.log(error)
        res.status(500).json({data:[],error:error})

    }
})

//Updating the Sales values
app.patch('/patientsbillupdate/:id',async(req,res,next)=>{
    try{
        const _id=req.params.id;
        const options={new:true}
        const result = await patient.findByIdAndUpdate(_id,updates,options)
        result.save()
        res.send(result);
    }
    catch(error){
        console.log(error)
        res.status(500).json({data:[],error:error})

    }
})
