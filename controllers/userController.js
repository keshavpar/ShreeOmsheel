const jwt = require('jsonwebtoken');
const User = require('./../models/user');
const asyncErrorHandler = require('./../utils/asyncErrorHandler');
const CustomError = require('./../utils/customError');
const attachDoctorIfNeeded = require('../utils/attachDoctorIfNeeded');

// Helper: Generate signed JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.SECRET_STR, {
    expiresIn: process.env.TOKEN_EXPIRES_IN,
  });
};

// Helper: Send token in response
const createSendToken = async (user, statusCode, res) => {
  user.password = undefined;

  const token = signToken(user._id);

  let doctor = null;
  if (user.role === 'doctor') {
    doctor = await attachDoctorIfNeeded(user);
  }

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
      ...(doctor && { doctor })
    },
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
// Single atomic op. The previous read-modify-write loaded the whole user
// document (attendance[] grows ~86 KB/year) and rewrote it in full on every
// login. The $not/$elemMatch guard replicates the old "once per calendar day"
// check server-side, so a double login can no longer race in two entries.
exports.markAttendance = async (userId) => {
  try {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    await User.updateOne(
      {
        _id: userId,
        attendance: {
          $not: { $elemMatch: { date: { $gte: dayStart, $lt: dayEnd } } },
        },
      },
      { $push: { attendance: { date: new Date(), status: 'present' } } }
    );
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
//
// Returns `presentDays` — the number of days the user has been marked present —
// computed inside MongoDB via $size/$filter, so the attendance[] array itself is
// never transferred. That array grows ~86 KB per user per year (~429 KB at five
// years), which previously went over the wire in full on every call to this
// endpoint just so a count could be derived client-side.
//
// Cost note: $filter is a single linear pass over an array the server already
// holds in memory — microseconds. It replaces the multi-MB transfer and the
// BSON deserialization that dominated this request, so total cost drops sharply.
//
// ?includeAttendance=true restores the previous response exactly (full
// attendance[] and dailyWork[]), as an escape hatch for any screen still
// reading the raw arrays.
exports.getAllUsers = asyncErrorHandler(async (req, res, next) => {
  try {
    const includeAttendance = req.query.includeAttendance === 'true';

    // NOTE: aggregate() bypasses schema-level `select: false`, so `password`
    // is excluded by virtue of this being an inclusion projection — it must
    // never be added to this list.
    const projection = {
      name:           1,
      email:          1,
      role:           1,
      isActive:       1,
      lastLogin:      1,
      aadhaarNumber:  1,
      aadhaarCardUrl: 1,
      createdBy:      1,
      lastModifiedBy: 1,
      presentDays: {
        $size: {
          $filter: {
            // $ifNull guards users whose attendance field was never set
            input: { $ifNull: ['$attendance', []] },
            cond:  { $eq: ['$$this.status', 'present'] },
          },
        },
      },
    };

    if (includeAttendance) {
      projection.attendance = 1;
      projection.dailyWork  = 1;
    }

    const users = await User.aggregate([{ $project: projection }]);

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
