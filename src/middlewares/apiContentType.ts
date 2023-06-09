import { Request, Response, NextFunction } from 'express';

import { BadRequestError } from '../helpers/apiError';

export default function (req: Request, res: Response, next: NextFunction) {
  if (
    (req.method === 'POST' || req.method === 'PUT') &&
    !(req.is('application/json') || req.is('multipart/form-data'))
  ) {
    next(new BadRequestError());
  } else {
    next();
  }
}
