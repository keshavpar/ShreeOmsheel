const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./utils/logger');


const CustomError = require('./utils/customError');
const globalErrorHandler = require('./controllers/errorController');

const patientRouter = require('./routes/patientRoute');
const medicalExamRouter = require('./routes/medExamRoute');
const medicinesRouter = require('./routes/medicineRoute');
const userRouter = require('./routes/userRoute');
const doctorRouter = require('./routes/doctorRoute');
const otpRoutes = require('./routes/otp_routes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const { swaggerUi, swaggerSpec } = require('./swagger');

const app = express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(express.json());
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}

//Default Page
// Replace console.log with logger.info
app.get("/", (req, res) => {
  logger.info("Root route accessed");
  res.send("Welcome to Shree Omsheel Ayurvedic Pharmacy and Research Centre");
});

// Log incoming requests (optional, in addition to morgan)
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});
app.use('/ShreeOmsheel/patient', patientRouter);
app.use('/ShreeOmsheel/medicalExam', medicalExamRouter);
app.use('/ShreeOmsheel/medicines', medicinesRouter);
app.use('/ShreeOmsheel/users', userRouter);
app.use('/ShreeOmsheel/doctors', doctorRouter);
app.use('/ShreeOmsheel/otp', otpRoutes);

app.use('/api', appointmentRoutes);


app.all('*', (req, res, next) => {
    const err = new CustomError(`The url with ${req.originalUrl} doesn't exists on the server`, 404);
    next(err);
});

app.use(globalErrorHandler);

module.exports = app;