const mongoose = require('mongoose');

const patients = new mongoose.Schema({     
    aadharnumber: {
        type: String,
        required: [true, 'Enter the Aadhar Number'],
        trim: true, // Trim the leading and back whitespaces
        maxlength: [12, 'Aadhar Number must be of 12 digits'],
        minlength: [12, 'Aadhar Number must be of 12 digits']
    },
    age: {
        type: Number,
        default: 20
    },
    name: {
        type: String,
        required: [true, 'Enter Patient Name!'],
        trim: true,
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    fathersname: {
        type: String,
        trim: true,
        default: ''
    },
    occupation: {
        type: String,
        trim: true,
        default: ''
    },
    /* bp: {
        type: String,
        default: 0
    },
    pulse: {
        type: Number,
        default: 0
    },
    */
    education: {
        type: String,
        trim: true,
        default: ''
    },
    city: {
        type: String,
        trim: true,
        default: ''
    },
    state: {
        type: String,
        trim: true,
        default: ''
    },
    addictionperiod: {
        type: String,
        default: ''
    },
    quantity: {
        type: String,
        default: ''
    },
    maritalstatus: {
        type: String,
        default: ''
    },
    weight:{ 
        type: Number,
        default: ''
    },
    gender:{
        type: String,
        default:' Male'
    },
    /*
     jivha: {
        type: String,
        default: ''
    },
    Nadi: {
        type: String,
        default: ''
    },
    */
    Date: {
        type: Date,
        default: Date.now()
    },
    totalcap: {
        type: Number,
        default: 0
    },
    captoday: {
        type: Number,
        default: 0
    },
    Startdosage: {
        type: Number,
        default: 0
    },
    expectedDate: {
        type: Date,
        default: Date.now()
    },
    phonenumber: {
        type: String,
        trime: true
    },
    price: {// Total Price of all Meds : { (Qt0 * Prc0) + (Qt1 * Prc1) + ... }
        type: Number,// OR Individual Price of meds [ Prc0, Prc1, ... ]
        default: 0 // OR Individual Price of all Meds (Price * Quants) [ (Qt0 * Prc0), (Qt1 * Prc1), .. ]
    }, 
    quantitymed: {// Total Quantity of all Meds : { Qt0 + Qt1 + .. }
        type: Number,// OR Individual Quantity of meds [ Qt0, Qt1, ... ]
        default: 0
    }, 
    medicinelist:{
        type: [
            {
                name: {
                    type:String,
                    required: [true, 'Enter the medicine Name'],
                    default:''
                },
                opiumated: {
                    type:Boolean,
                    default:false
                },
                description: {
                    type:String,
                    default:''
                },
                batch_no: {
                    type:Number,
                    default:0
                },
                price: {
                    type:Number,
                    defualt:0
                },
                cgst: {
                    type:Number,
                    default:0
                },
                sgst: {
                    type:Number,
                    default:0
                },
                mfg_date: {
                    type:String,
                    default:Date.now
                },
                expiry_date: {
                    type:String,
                    default:''
                },
                quantity: {
                    type:Number,
                    default:0
                }
            }
        ]
    },
    medicalExams: {
        type: [
            {
                Bp: {
                    type:String,
                    default:""
                },
                Pulse: {
                    type:String,
                    default:""
                },
                Nadi: {
                    type:String,
                    default:""
                },
                Jivha: {
                    type:String,
                    default:""
                },
                time: {
                    type:Date,
                    default:Date.now
                },
                doctorName: {
                    type:String,
                    default:""
                },
                capgiven: {
                    type:Number,
                    default:0
                },
                findings: {
                    type:String,
                    default:""
                }
            }
        ]
    }
});


module.exports = mongoose.model("Patient",patients);    

// Total Price if needed { (Qt0 * Prc0) + (Qt1 * Prc1) + .. } can be done by post-save hook

/*

  Using References to seperate collections instead of embedding the collections into one is actually a tradeoff between Time and Space
  If there will be not more than 15 - 20 Medicines or 15 - 20 medExams. We should go for embedding all into Patient Model.
  Querying through referenced structure takes more time. 
  Embedding into one takes more space. (But in mongodb we have a limit of one document of aprx 15Mb)
  

  If there's not a huge number of medExams or meds, we should embed it into one collection. For which querying will be optimized

*/