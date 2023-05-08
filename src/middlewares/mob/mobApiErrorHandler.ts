import { Request, Response, NextFunction } from 'express';

import ApiError from '../../helpers/mobApiError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (error: ApiError, req: Request, res: Response, next: NextFunction) {
  res.status(Number.isInteger(error.code) ? error.code : 500).json({
    result: {},
    message: error.message
  });
}
