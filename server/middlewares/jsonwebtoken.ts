import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET } from '../constants';
import { NextFunction, Request, Response } from 'express';

interface AuthPayload extends JwtPayload {
  // Define additional properties if needed
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

const signToken = (payload: JwtPayload = {}, expiresIn = '12h') => {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
  return token;
};

const authorizeBearerToken = (request: Request, response: Response, next: NextFunction) => {
  try {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      return response.status(400).json({
        message: 'Token not provided',
      });
    }

    const auth = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (!auth) {
      return response.status(401).json({
        message: 'Unauthorized - invalid token',
      });
    }

    request.auth = auth;
    next();
  } catch (error) {
    console.error(error);
    return response.status(401).json({
      message: 'Unauthorized - invalid token',
    });
  }
};

export {
  authorizeBearerToken,
  signToken,
};