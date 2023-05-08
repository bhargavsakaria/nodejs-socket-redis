import { NextFunction, Request, Response } from 'express';
import {
  paginationSchemaValidator,
  loginSchemaValidator,
  autoAnswerSchemaValidator,
  versionUpdateSchemaValidator,
  awsImageUploadValidator,
  getLatestVersionSchemaValidator
} from '../../helpers/validator';
import { HttpError } from '../../helpers/mobApiError';

const joiErrorTranslator = (error: any, message: string, code: number, next: NextFunction) => {
  let validationMessage = message;
  if (error.label != '') {
    const label = error.label;
    // TODO: Find and Replace for all the error messages will be made generalized in future!
    validationMessage = message.replace('{{#label}}', label);
  }
  // @ts-ignore
  return next(new HttpError(validationMessage, {}, code));
};

export const paginationValidationMidware = async (req: Request, res: Response, next: NextFunction) => {
  const payload = {
    take: req.body?.take ?? 15,
    skip: req.body?.skip ?? 0
  };

  const { error } = paginationSchemaValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }

  next();
};

export const loginValidationMidware = async (req: Request, res: Response, next: NextFunction) => {
  const payload = {
    email_or_username: req.body.email_or_username,
    password: req.body.password,
    device_token: req.body.device_token,
    platform: req.body.platform
  };

  const { error } = loginSchemaValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }
  next();
};

export const autoAnswerValidationMidware = async (req: Request, res: Response, next: NextFunction) => {
  const status = req.body.status;

  const payload = { status };

  const { error } = autoAnswerSchemaValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }
  next();
};

export const versionUpdateValidatorMidware = async (req: Request, res: Response, next: NextFunction) => {
  const payload = {
    version_no: req.body.version_no,
    device_token: req.body.device_token,
    platform: req.body.platform
  };

  const { error } = versionUpdateSchemaValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }
  next();
};

export const getLatestVersionValidatorMidware = async (req: Request, res: Response, next: NextFunction) => {
  const payload = { platform: req.body.platform };

  const { error } = getLatestVersionSchemaValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }
  next();
};

export const awsImageUploadValidationMidware = async (req: Request, res: Response, next: NextFunction) => {
  const payload = { image_name: req.body.image_name };

  const { error } = awsImageUploadValidator.validate(payload);
  if (error) {
    // @ts-ignore
    const message = error.error.message;
    // @ts-ignore
    return joiErrorTranslator(error.error, req.t(message), error.code, next);
  }
  next();
};
