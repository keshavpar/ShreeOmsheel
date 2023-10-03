const jwt = require('jsonwebtoken');

const User = require('./../models/user');

const asyncErrorHandler = require('./../utils/asyncErrorHandler');
const CustomError = require('./../utils/customError');

const signToken = id => {
    console.log(process.env.SECRET_STR);
    console.log(process.env.TOKEN_EXPIRES_IN);
    return jwt.sign({id}, process.env.SECRET_STR, {
        expiresIn: process.env.TOKEN_EXPIRES_IN
    })
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });
}

exports.signup = asyncErrorHandler( async (req, res, next) => {
    const user = await User.create(req.body);

    // Sending  jwt token to directly redirect to login
   createSendToken(user, 201, res);
})

exports.login = asyncErrorHandler( async (req, res, next) => {
    // 1. Check if user email or password present in request body or not
    const email = req.body.email;
    const password = req.body.password;
    console.log(email,password)
    if(!email || !password){
        next(new CustomError("Use valid credentials to login ! "));
    }

    // 2. Check if user exists with gievn mail
    const user = await User.findOne({email}).select('+password');

    // 3. match the passwords
    if(!user || user.comparePasswordsinDB(password, user.password)){
        next(new CustomError("User with this credentials didn't found"))
    }
    // 4. send jwt token
    createSendToken(user, 200, res);

    // 5. Logged In
})