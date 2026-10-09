const CustomError = require('../utils/customError');

module.exports = function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new CustomError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
