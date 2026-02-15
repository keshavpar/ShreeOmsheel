const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

const TaperingEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  morning: { type: Number, required: true },
  evening: { type: Number, required: true },
}, { _id: false });

// Medicine Subschema
const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  opiumated: { type: Boolean, default: false },
  description: { type: String, default: '', trim: true },
  batch_no: { type: String, default: '' },
  price: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  mfg_date: { type: Date },
  expiry_date: { type: Date },
  quantity: { type: Number, default: 0 },
  
});

const ObservationSchema = new mongoose.Schema({
  bp: { type: String, default: '' },
  pulse: { type: String, default: '' },
  nadi: { type: String, default: '' },
  dosh: { type: String, default: '' },
  bal: { type: String, default: '' },
  jivha: { type: String, default: '' },

  findings: { type: String, default: '', trim: true },
  capgiven: { type: Number, default: 0 },

  time: { type: Date, default: Date.now },

  doctor: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    name: { type: String, required: true }
  }
});

// Medical Examination Subschema with embedded medicines
const MedicalExamSchema = new mongoose.Schema({
  bp: { type: String, default: '' },
  pulse: { type: String, default: '' },
  nadi: { type: String, default: '' },
  dosh:{type: String, default: '' },
  bal: { type: String, default: '' },
  jivha: { type: String, default: '' },
  time: { type: Date, default: Date.now },
  findings: { type: String, default: '', trim: true },
  capgiven: { type: Number, default: 0 },
  medicines: { type: [MedicineSchema], default: [] },
  doctor: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    name: { type: String, required: true }
  },
  tapering: { type: [TaperingEntrySchema], default: [] }
});

// Report Subschema
const ReportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

// Patient Main Schema
const PatientSchema = new mongoose.Schema({
  aadharnumber: {
    type: String,
    required: true,
    unique: true,
    maxlength: 12,
    minlength: 12,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  age: { type: Number, default: 20 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  weight: { type: Number },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  phonenumber: { type: String, trim: true },
  fathersname: { type: String, trim: true },
  occupation: { type: String, trim: true },
  education: { type: String, trim: true },
  maritalstatus: { type: String, trim: true },
  addictionperiod: { type: String, trim: true },
  quantity: { type: String, trim: true },
  image: { type: String, default: '' },
  observations: { type: [ObservationSchema], default: [] },
  medicalExams: { type: [MedicalExamSchema], default: [] },
  totalcap: { type: Number, default: 0 },
  captoday: { type: Number, default: 0 },
  Startdosage: { type: Number, default: 0 },
  dosage: { type: Number, default: 0 },
  
  expectedDate: { type: Date },

  reports: { type: [ReportSchema], default: [] },
  
  affidavitDocumentUrl: { type: String, default: '' },
//Add the prescription counter updation funcrtion
  patientPrescriptionCounter:{type: Number, default: 0},
  blacklist: { type: Boolean, default: false },
  createdBy: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'doctor', 'staff'], required: true }
  },
  lastModifiedBy: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'doctor', 'staff'] }
  },
}, { timestamps: true });

module.exports = mongoose.model('Patients', PatientSchema);
