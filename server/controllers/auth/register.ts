import joi from 'joi';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import Account, { IAccount } from '../../models/Account';
import { signToken } from '../../middlewares/jsonwebtoken';

interface RegisterRequest extends Request {
  body: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    confirmPassword: string;
  };
}

const register = async (request: RegisterRequest, response: Response, next: NextFunction) => {
  try {
    // Validate request data
    await joi
      .object({
        email: joi.string().email().required(),
        firstName: joi.string().required(),
        lastName: joi.string().required(),
        password: joi.string().required(),
        confirmPassword: joi.string().required(),
      })
      .validateAsync(request.body);
  } catch (error) {
    return response.status(400).json({
      error: 'ValidationError',
      message: (error as {message: string}).message,
    });
  }

  try {
    const {
      email,
      firstName,
      lastName,
      password,
      confirmPassword,
    } = request.body;

    // Verify account username as unique
    const existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      return response.status(400).json({
        error: email,
        message: 'An account already exists with that email',
      });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Create account
    const newAccount = new Account({
      email,
      firstName,
      lastName,
      password: hash
    });
    await newAccount.save();

    const newAccountClone = newAccount.toObject() as Partial<IAccount>
    // Remove password from response data
    newAccountClone.password = undefined;
    delete newAccountClone.password;
    // Remove password from response data
    newAccountClone.password = undefined;
    delete newAccountClone.password;

    // Generate access token
    const token = signToken({ uid: newAccountClone._id, role: newAccountClone.role });

    response.status(201).json({
      ...newAccountClone,
      token,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).send();
  }
};

export { register };
