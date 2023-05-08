import passport from 'passport';
import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../helpers/mobApiError';
import { HttpStatus } from '../../typings/global/http-status.enum';
import User from '../../entities/User.postgres';

const mobileTokenVerify = async (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt-mob', function (error, user: User) {
    if (error) {
      return next(
        new HttpError(
          error.message || error || req.t('backend:error.something_went_wrong'),
          {},
          error.code || HttpStatus.INTERNAL_SERVER_ERROR
        )
      );
    }

    if (!user) {
      return next(new HttpError(req.t('backend:error.invalid_token'), {}, HttpStatus.UNAUTHORIZED));
    }
    req.user = user;
    return next();
  })(req, res, next);
};

export default mobileTokenVerify;
