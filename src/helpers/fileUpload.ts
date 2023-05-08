import { Request } from 'express';
import multer from 'multer';
import { FILE_LIMIT } from '../utils/constants';
import { HttpStatus } from '../typings/global/http-status.enum';
import { HttpError } from './mobApiError';

// @ts-ignore
const fileFilter = (req: Request, file: Express.Multer.File, cb) => {
  if (file.mimetype.match(/(image\/jpeg|image\/png|image\/heif|image\/tiff|image\/webp|image\/x-panasonic-raw)$/)) {
    cb(null, true);
  } else {
    cb(new HttpError(req.t('backend:error.image_type_not_allowed'), file, HttpStatus.BAD_REQUEST), false);
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: FILE_LIMIT } }).single('image');

export default upload;
