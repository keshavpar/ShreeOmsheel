const express = require('express');
const morgan = require('morgan');

const CustomError = require('./utils/customError');
const globalErrorHandler = require('./controllers/errorController');

const patientRouter = require('./routes/patientRoute');
const medicalExamRouter = require('./routes/medExamRoute');
const medicinesRouter = require('./routes/medicineRoute');
const userRouter = require('./routes/userRoute');
const doctorRouter = require('./routes/doctorRoute');

const app = express();

app.use(express.json());

if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}

//Default Page
app.get("/",(req,res)=>{
    res.send("Welcome to Shree Omsheel Ayurvedic Pharmacy and Research Centre")
    res.end()
})
app.use('/ShreeOmsheel/patient', patientRouter);
app.use('/ShreeOmsheel/medicalExam', medicalExamRouter);
app.use('/ShreeOmsheel/medicines', medicinesRouter);
app.use('/ShreeOmsheel/users', userRouter);
app.use('/ShreeOmsheel/doctors', doctorRouter);
app.all('*', (req, res, next) => {
    const err = new CustomError(`The url with ${req.originalUrl} doesn't exists on the server`, 404);
    next(err);
});

app.use(globalErrorHandler);

module.exports = app;