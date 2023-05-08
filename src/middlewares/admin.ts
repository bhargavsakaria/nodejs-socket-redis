import { Request, Response, NextFunction } from 'express';

import { UnauthorizedError } from '../helpers/apiError';
import User from '../entities/User.postgres';

const admin = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User;

  if (user && user.isAdmin) {
    return next();
  } else {
    return next(new UnauthorizedError('Not authorized as an admin'));
  }
};

export default admin;
