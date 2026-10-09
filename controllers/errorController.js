const CustomError = require('./../utils/customError');
const logger = require('../utils/logger');

// DEV error handler
const devErrors = (res, error) => {
  logger.error(`[DEV] ${error.message}\nStack: ${error.stack}`);
  res.status(error.statusCode).json({
    status: error.statusCode,
    message: error.message,
    stackTrace: error.stack,
    error: error,
  });
};

// DUPLICATE key error handler
const duplicateKeyErrorHandler = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const msg = `User with ${field} '${value}' already exists.`;
  return new CustomError(msg, 400);
};

// CAST error handler
const castErrorHandler = (err) => {
  const msg = `Invalid value for ${err.path}: ${err.value}`;
  return new CustomError(msg, 400);
};

// VALIDATION error handler
const validationErrorHandler = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const errorMessages = errors.join('. ');
  const msg = `Invalid input data: ${errorMessages}`;
  return new CustomError(msg, 400);
};

// PROD error handler
const prodErrors = (res, error) => {
  if (error.isOperational) {
    logger.warn(`[PROD][Operational] ${error.message}`);
    res.status(error.statusCode).json({
      status: error.statusCode,
      message: error.message,
    });
  } else {
    logger.error(`[PROD][Unknown Error] ${error.message}\nStack: ${error.stack}`);
    res.status(500).json({
      status: 'Error',
      message: 'Something went wrong! Please try again later',
    });
  }
};

const env = process.env.NODE_ENV || 'development';

module.exports = (error, req, res, next) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  if (env === 'development' || env === 'test') {
    devErrors(res, error);
  } else {
    // Custom known error conversions for PROD
    if (error.code === 11000) error = duplicateKeyErrorHandler(error);
    if (error.name === 'CastError') error = castErrorHandler(error);
    if (error.name === 'ValidationError') error = validationErrorHandler(error);

    prodErrors(res, error);
  }
};
