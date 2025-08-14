const jwt = require('jsonwebtoken');
const User = require('./../models/user');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');
const CustomError = require('./../utils/customError');

// Helper: Generate signed JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.SECRET_STR, {
    expiresIn: process.env.TOKEN_EXPIRES_IN,
  });
};

// Helper: Send token in response
const createSendToken = (user, statusCode, res) => {
  user.password = undefined;
  const token = signToken(user._id);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

// Signup
exports.signup = asyncErrorHandler(async (req, res, next) => {
  try {
    console.log('Signup request body:', req.body);
    const user = await User.create(req.body);
    console.log('User created:', user);
    createSendToken(user, 201, res);
  } catch (err) {
    console.error('Signup error:', err);
    return next(err);
  }
});

// Login
exports.login = asyncErrorHandler(async (req, res, next) => {
  try {
    
    const { email, password } = req.body;
   
    if (!email || !password) {
    
      return next(new CustomError('Please provide both email and password!', 400));
    }

    
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
     
      return next(new CustomError('Incorrect email or password', 401));
    }


    const isMatch = await user.comparePasswordsinDB(password, user.password);
    if (!isMatch) {
      console.log('❌ Passwords do not match');
      return next(new CustomError('Incorrect email or password', 401));
    }


    
    console.log('📝 Marking attendance...');
    await exports.markAttendance(user._id);
    

    console.log('🚀 Sending token to client...');
    createSendToken(user, 200, res);
  } catch (err) {
    console.error('🔥 Login error caught in catch block:', err);
    return next(err);
  }
});


// Mark attendance (utility)
exports.markAttendance = async (userId) => {
  try {
    const today = new Date().toDateString();
    const user = await User.findById(userId);

    const alreadyMarked = user.attendance.some(
      (entry) => new Date(entry.date).toDateString() === today
    );

    if (!alreadyMarked) {
      user.attendance.push({ date: new Date(), status: 'present' });
      await user.save({ validateBeforeSave: false });
    }
  } catch (err) {
    console.error('Error marking attendance:', err);
    throw err;
  }
};

// Manual attendance route
exports.logAttendance = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    await exports.markAttendance(userId);
    res.status(200).json({ status: 'success', message: 'Attendance logged' });
  } catch (err) {
    console.error('Log attendance error:', err);
    return next(err);
  }
});

// Get assigned work for a specific user
exports.getAssignedWork = asyncErrorHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!userId) {
    return next(new CustomError('User ID is required', 400));
  }

  const user = await User.findById(userId).select('name role dailyWork');

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        name: user.name,
        role: user.role,
        assignedWork: user.dailyWork
      }
    }
  });
});

// Assign daily work
exports.assignWork = asyncErrorHandler(async (req, res, next) => {
  try {
    const { userId, task } = req.body;

    if (!userId || !task) {
      return next(new CustomError('User ID and task are required', 400));
    }

    const user = await User.findById(userId);
    if (!user || !['doctor', 'staff'].includes(user.role)) {
      return next(new CustomError('Only doctor or staff can be assigned work', 400));
    }

    user.dailyWork.push({ task, completed: false, date: new Date() });
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ status: 'success', message: 'Work assigned successfully' });
  } catch (err) {
    console.error('Assign work error:', err);
    return next(err);
  }
});

// Mark task complete
exports.completeWork = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { taskIndex } = req.params;

    if (taskIndex === undefined) {
      return next(new CustomError('Task index is required', 400));
    }

    const user = await User.findById(userId);
    if (!user.dailyWork[taskIndex]) {
      return next(new CustomError('Task not found', 404));
    }

    user.dailyWork[taskIndex].completed = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ status: 'success', message: 'Task marked as completed' });
  } catch (err) {
    console.error('Complete work error:', err);
    return next(err);
  }
});

// Get all users
exports.getAllUsers = asyncErrorHandler(async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ status: 'success', results: users.length, data: { users } });
  } catch (err) {
    console.error('Get all users error:', err);
    return next(err);
  }
});

// Toggle user status
exports.toggleUserActive = asyncErrorHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return next(new CustomError('User not found', 404));

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: `User is now ${user.isActive ? 'active' : 'inactive'}`,
    });
  } catch (err) {
    console.error('Toggle user active error:', err);
    return next(err);
  }
});
