import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

import { NotFoundError, UnauthorizedError, InternalServerError } from '../helpers/apiError';
import User from '../entities/User.postgres';

// auth controllers for user
export const userLogin = async (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (error, user: User, info) => {
    if (error) {
      return next(new InternalServerError());
    }
    if (!user) {
      if (info.message === 'Invalid username or password') {
        return next(new UnauthorizedError(info.message));
      }
      return next(new NotFoundError(info.message));
    }

    const id = user.id;
    const token = jwt.sign({ id: id, role: user.role }, process.env.JWT_SECRET as string);
    // @ts-ignore
    user.stripePublicKey = process.env.STRIPE_PUBLIC_KEY;
    const userSerialize = { ...user, token };
    res.deliver(200, 'Success', userSerialize);
  })(req, res, next);
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    // @ts-ignore
    user.stripePublicKey = process.env.STRIPE_PUBLIC_KEY;
    res.deliver(200, 'Success', user);
  } catch (error) {
    next(new InternalServerError());
  }
};
