const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

const TaperingEntrySchema = new mongoose.Schema({
  date:      { type: Date,   required: true },
  morning:   { type: Number, required: true },
  evening:   { type: Number, required: true },
  // null = not yet visited | Date = exact timestamp patient came in
  // !!visitedAt → did they visit? | visitedAt vs date → were they on time?
  visitedAt: { type: Date,   default: null  },
}, { _id: false });

// Medicine Subschema
const MedicineSchema = new mongoose.Schema({
  name:        { type: String,  required: true, trim: true },
  opiumated:   { type: Boolean, default: false },
  description: { type: String,  default: '', trim: true },
  batch_no:    { type: String,  default: '' },
  price:       { type: Number,  default: 0 },
  cgst:        { type: Number,  default: 0 },
  sgst:        { type: Number,  default: 0 },
  mfg_date:    { type: Date },
  expiry_date: { type: Date },
  quantity:    { type: Number,  default: 0 },
});

const ObservationSchema = new mongoose.Schema({
  bp:       { type: String, default: '' },
  pulse:    { type: String, default: '' },
  nadi:     { type: String, default: '' },
  dosh:     { type: String, default: '' },
  bal:      { type: String, default: '' },
  jivha:    { type: String, default: '' },
  findings: { type: String, default: '', trim: true },
  capgiven: { type: Number, default: 0 },
  soscap:   { type: Number, default: 0 },
  time:     { type: Date,   default: Date.now },
  doctor: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    name: { type: String, required: true }
  }
});

// Medical Examination Subschema with embedded medicines
const MedicalExamSchema = new mongoose.Schema({
  bp:       { type: String, default: '' },
  pulse:    { type: String, default: '' },
  nadi:     { type: String, default: '' },
  dosh:     { type: String, default: '' },
  bal:      { type: String, default: '' },
  jivha:    { type: String, default: '' },
  time:     { type: Date,   default: Date.now },
  findings: { type: String, default: '', trim: true },
  capgiven: { type: Number, default: 0 },
  medicines: { type: [MedicineSchema], default: [] },
  doctor: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    name: { type: String, required: true }
  },
  tapering: { type: [TaperingEntrySchema], default: [] }
});

// Report Subschema
// url is optional at creation — doctor adds title first,
// lab technician uploads the file and patches url later.
const ReportSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  url:       { type: String, default: '' },   // empty until lab uploads
  uploadedAt:{ type: Date,   default: null },  // set when url is added
}, { _id: false });

// ─── Tapering Status Subschema ────────────────────────────────────────────────
// Tracks which exam + which step in that exam's tapering[] the patient is on.
// Updated by the controller every time a new medicalExam is saved or
// a staff member marks a visit as completed.
const TaperingStatusSchema = new mongoose.Schema({
  // Which medicalExam this active taper belongs to
  examId:      { type: mongoose.Schema.Types.ObjectId, required: true },
  // Index into that exam's tapering[] array — current active step
  stepIndex:   { type: Number, default: 0, min: 0 },
  // true when stepIndex has passed the last entry in tapering[]
  isCompleted: { type: Boolean, default: false },
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
  // index: true on name — speeds up case-insensitive regex on list queries.
  // Note: a regex without ^ anchor still scans but index reduces candidate set
  // significantly on large collections vs a full collection scan.
  name:            { type: String, required: true, trim: true, index: true },
  age:             { type: Number, default: 20 },
  gender:          { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
  weight:          { type: Number },
  address:         { type: String, trim: true },
  // index: true on city + state — used in getAllPatients filter
  city:            { type: String, trim: true, index: true },
  state:           { type: String, trim: true, index: true },
  phonenumber:     { type: String, trim: true },
  fathersname:     { type: String, trim: true },
  occupation:      { type: String, trim: true },
  education:       { type: String, trim: true },
  maritalstatus:   { type: String, trim: true },
  addictionperiod: { type: String, trim: true },
  quantity:        { type: String, trim: true },
  image:           { type: String, default: '' },
  prakruti:         { type: String, trim: true },
  observations: { type: [ObservationSchema], default: [] },
  medicalExams: { type: [MedicalExamSchema], default: [] },

  totalcap:     { type: Number, default: 0 },
  captoday:     { type: Number, default: 0 },
  Startdosage:  { type: Number, default: 0 },

  // ── Active taper tracking (auto-computed by controller on exam save) ────────
  // Current dosage = morning + evening of the active tapering step
  dosage:       { type: Number, default: 0 },
  // Next visit date = tapering[stepIndex + 1].date of the active tapering step
  expectedDate: { type: Date },
  // When the patient actually last walked in (set on visit mark)
  lastVisitedDate: { type: Date, default: null },
  // Pointer to the active exam + step — the single source of truth
  taperingStatus: { type: TaperingStatusSchema, default: null },
  // ────────────────────────────────────────────────────────────────────────────

  reports:              { type: [ReportSchema], default: [] },
  affidavitDocumentUrl: { type: String,  default: '' },
  patientPrescriptionCounter: { type: Number, default: 0 },
  blacklist:            { type: Boolean, default: false },

  createdBy: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'doctor', 'staff'], required: true }
  },
  lastModifiedBy: {
    _id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'doctor', 'staff'] }
  },
}, { timestamps: true });

// ─── Compound indexes ──────────────────────────────────────────────────────────
// createdAt DESC — powers date range filter + default sort on list page
PatientSchema.index({ createdAt: -1 });

// city + createdAt — covers the most common combined query: filter by city, sort latest first
PatientSchema.index({ city: 1, createdAt: -1 });

// blacklist — used when querying active (non-blacklisted) patients
PatientSchema.index({ blacklist: 1 });
// ──────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Patients', PatientSchema);