import joi from 'joi';
import { YesNo } from '../../utils/constants';
import { HttpStatus } from '../../typings/global/http-status.enum';
import { HttpError } from '../mobApiError';

const joiErrorExtractor = (error: any) => {
  const err = error[0];

  const error_message = `joi:${err.code}`;

  const errObject = {
    message: error_message,
    label: err.local.label,
    value: err.local.value
  };

  return new HttpError('', errObject, HttpStatus.BAD_REQUEST);
};

export const paginationSchemaValidator = joi.object().keys({
  take: joi
    .number()
    .integer()
    .required()
    .error((error) => joiErrorExtractor(error)),
  skip: joi
    .number()
    .integer()
    .required()
    .error((error) => joiErrorExtractor(error))
});

export const loginSchemaValidator = joi.object().keys({
  email_or_username: joi
    .string()
    .required()
    .error((error) => joiErrorExtractor(error)),
  password: joi
    .string()
    .trim(true)
    .required()
    .error((error) => joiErrorExtractor(error)),
  device_token: joi
    .string()
    .trim(true)
    .required()
    .error((error) => joiErrorExtractor(error)),
  platform: joi
    .string()
    .trim(true)
    .required()
    .error((error) => joiErrorExtractor(error))
});

export const autoAnswerSchemaValidator = joi.object().keys({
  status: joi
    .boolean()
    .truthy(1)
    .falsy(0)
    .required()
    .error((error) => joiErrorExtractor(error))
});

export const versionUpdateSchemaValidator = joi.object().keys({
  version_no: joi
    .string()
    .trim()
    .required()
    .error((error) => joiErrorExtractor(error)),
  device_token: joi
    .string()
    .trim()
    .required()
    .error((error) => joiErrorExtractor(error)),
  platform: joi
    .string()
    .trim()
    .required()
    .error((error) => joiErrorExtractor(error))
});

export const getLatestVersionSchemaValidator = joi.object().keys({
  platform: joi
    .string()
    .trim()
    .required()
    .error((error) => joiErrorExtractor(error))
});

export const awsImageUploadValidator = joi.object().keys({
  image_name: joi
    .string()
    .trim()
    .required()
    .error((error) => joiErrorExtractor(error))
});
