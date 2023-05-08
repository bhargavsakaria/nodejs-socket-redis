import { Request, Response, NextFunction } from 'express';
import lodashSize from 'lodash/size';

/* Mobile response format */
export function mobResponseHandler(req: Request, res: Response, next: NextFunction) {
  res.mobDeliver = (result, message?) => {
    res.json({ result: lodashSize(result) ? result : {}, message: message ?? '' });
  };

  next();
}

/* Web portal response format */
export function webResponseHandler(req: Request, res: Response, next: NextFunction) {
  res.deliver = (status, message, payload?) => {
    res.json({
      status,
      message,
      payload
    });
  };
  next();
}
