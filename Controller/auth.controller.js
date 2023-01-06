import User from '../models/user.schema';
import asyncHandler from '../services/asyncHndler';
import CustomError from '../utils/customError';
import cookieOptions from '../utils/cookieOptions';
import mailHelper from '../utils/mailHelper';

/**********************************************************
 * @SIGNUP
 * @route http://localhost:4000/api/auth/signup
 * @description User controller signup for creating new user
 * @parameters name email and password
 * @returns User object
 **********************************************************/

export const signUp = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new CustomError('Plase Fill all details', 400);
  }

  //   Check if user exists
  const existingUser = User.findOne({ email });

  if (existingUser) {
    throw new CustomError('User already exists', 400);
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  const token = user.getJwtToken();
  console.log(user);
  user.password = undefined;

  res.cookie('token', token, cookieOptions);

  res.status(200).json({
    success: true,
    token,
    user,
  });
});

/**********************************************************
 * @LOGIN
 * @route http://localhost:4000/api/auth/login
 * @description User controller for loging user
 * @parameters email and password
 * @returns User object
 **********************************************************/

export const logIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new CustomError('Please fill all fields', 400);
  }

  const user = User.findOne({ email }).select('+password');

  if (!user) {
    throw new CustomError('Invalid credentials', 400);
  }

  const isPasswordMatched = user.comparePassword;

  if (!isPasswordMatched) {
    throw new CustomError('Invalid credentials -pass', 400);
  }

  const token = user.getJwtToken();
  console.log(user);
  user.password = undefined;

  res.cookie('token', token, cookieOptions);

  res.status(200).json({
    success: true,
    token,
    user,
  });
});

/******************************************************
 * @LOGOUT
 * @route http://localhost:5000/api/auth/logout
 * @description User logout bby clearing user cookies
 * @parameters
 * @returns success message
 ******************************************************/

export const logOut = asyncHandler(async (req, res) => {
  //   res.clearCookie();
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'Logged Out',
  });
});

/******************************************************
 * @FORGOT_PASSWORD
 * @route http://localhost:5000/api/auth/password/forgot
 * @description User will submit email and we will generate a token
 * @parameters  email
 * @returns success message - email send
 ******************************************************/

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new CustomError('Please provide email', 400);
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  const resetToken = await user.generateForgotPasswordToken;

  await user.save({ validateBeforeSave: false });

  const resetUrl = `
  ${req.protocol}://${req.get('host')}/api/auth/password/reset/${resetToken}
  `;

  const text = `Your password reset url is
  \n\n ${resetUrl}\n\n
  `;

  try {
    await mailHelper({
      email: user.email,
      subject: 'Password reset email for website',
      text: text,
    })
      .res.status(200)
      .json({
        success: true,
        message: `Email send to ${user.email}`,
      });
  } catch (err) {
    //roll back - clear fields and save
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    throw new CustomError(err.message || 'Email sent failure', 500);
  }
});
