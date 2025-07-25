const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');

const s3Controller = require('../controllers/s3controller');
const protect = require('../middleware/auth_middleware');
const restrictTo = require('../middleware/restrict');

// Auth routes
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Aadhaar image S3 signed URL
router.post('/aadhaar/upload-url', protect, s3Controller.getSignedUrlForAadhaar);

// Admin-only actions
router.get('/all', protect, restrictTo('admin'), userController.getAllUsers);
router.patch('/:id/toggle-active', protect, restrictTo('admin'), userController.toggleUserActive);

// Staff/Doctor log attendance (on login) 
router.post('/attendance/log', protect, userController.logAttendance);

// Assign task to staff/doctor (admin only)
router.post('/:id/assign-task', protect, restrictTo('admin'), userController.assignWork);

// Mark task complete (by user)
router.patch('/:id/complete-task/:taskIndex', protect, userController.completeWork);

module.exports = router;
