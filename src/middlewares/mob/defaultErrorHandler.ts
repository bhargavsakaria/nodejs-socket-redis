import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../helpers/mobApiError';
import { HttpStatus } from '../../typings/global/http-status.enum';

// @ts-ignore
export default function defaultErrorHandler(error, req: Request, res: Response, next: NextFunction) {
  if (error && error.message && (error.code || error.statusCode)) {
    const element = error.message.split(':')[0];
    const error_message = element === 'backend' ? req.t(error.message) : error.message;
    return next(new HttpError(error_message, error.stack, error.code || error.statusCode));
  }

  console.log(error);
  return next(
    new HttpError(
      error.error ?? req.t('backend:error.something_went_wrong'),
      error.stack ?? error,
      HttpStatus.INTERNAL_SERVER_ERROR
    )
  );
}
