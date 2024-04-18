import joi from 'joi';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { signToken } from '../../middlewares/jsonwebtoken';
import Account, { IAccount } from '../../models/Account';

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

const login = async (request: LoginRequest, response: Response, next: NextFunction) => {
  try {
    // Validate request data
    await joi
      .object({
        email: joi.string().email().required(),
        password: joi.string().required(),
      })
      .validateAsync(request.body);
  } catch (error) {
    return response.status(400).json({
      error: 'ValidationError',
      message: (error as {message: string}).message,
    });
  }

  try {
    const { email, password } = request.body;

    // Get account from DB, and verify existence
    const foundAccount = await Account.findOne({ email });
    if (!foundAccount) {
      return response.status(400).json({
        message: 'Bad credentials',
      });
    }

    // Decrypt and verify password
    const passOk = await bcrypt.compare(password, foundAccount.password);
    if (!passOk) {
      return response.status(400).json({
        message: 'Bad credentials',
      });
    }
    const foundAccountClone = foundAccount.toObject() as Partial<IAccount>
    // Remove password from response data
    foundAccountClone.password = undefined;
    delete foundAccountClone.password;

    // Generate access token
    const token = signToken({ uid: foundAccountClone._id, role: foundAccountClone.role });

    response.status(200).json({
      ...foundAccountClone,
      token,
    });
  } catch (error) {
    console.error(error);
    response.status(500).send();
  }
};

export { login };
