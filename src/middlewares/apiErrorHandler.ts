import { Request, Response, NextFunction } from 'express';

import ApiError from '../helpers/apiError';
import logger from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (error: ApiError, req: Request, res: Response, next: NextFunction) {
  if (error.source) {
    logger.error(error.source);
  }

  res.status(error.statusCode).json({
    status: 'error',
    statusCode: error.statusCode,
    message: error.message
  });
}
