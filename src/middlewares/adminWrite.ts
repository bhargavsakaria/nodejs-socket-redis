import { Request, Response, NextFunction } from 'express';

import { InternalServerError, ForbiddenError } from '../helpers/apiError';
import User from '../entities/User.postgres';

const adminWrite = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User;

  if (user && user.isAdmin && !user.readOnly) {
    return next();
  } else {
    return next(new ForbiddenError('Authorized as an read-only admin'));
  }
};

export default adminWrite;
