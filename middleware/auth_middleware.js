const jwt = require('jsonwebtoken');
const User = require('../models/user');
const CustomError = require('../utils/customError');

module.exports = async function protect(req, res, next) {
  try {
    // 1. Get token from headers
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(new CustomError('You are not logged in!', 401));
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.SECRET_STR);

    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser || !currentUser.isActive) {
      return next(new CustomError('User no longer exists or is inactive.', 401));
    }

    // 4. Attach user to request
    req.user = currentUser;

    next();
  } catch (err) {
    return next(new CustomError('Invalid token or session expired', 401));
  }
};
