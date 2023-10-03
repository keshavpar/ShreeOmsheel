const express = require('express');

const router = express.Router();

const doctorController = require('./../controllers/doctorController');

router.route('/doctor')
    .get(doctorController.doctorLists)
    .post(doctorController.addDoctor)

router.route('/doctor/:id')
    .patch(doctorController.updateDoctor)
    .delete(doctorController.deleteDoctor);

module.exports = router;