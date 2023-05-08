import { NextFunction, Request, Response } from 'express';

import { InternalServerError, NotFoundError } from '../helpers/apiError';
import Alert from '../entities/Alert.postgres';

export const createAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert = req.body;
    const newAlert = Alert.create({ ...alert });
    const savedAlert = await Alert.save(newAlert);

    res.deliver(200, 'Success', savedAlert);
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const deleteAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alertId = parseInt(req.params.id);
    console.log(alertId);
    const alert = await Alert.findOne(alertId);
    console.log(alert);
    if (!alert) {
      return next(new NotFoundError('Alert is not found'));
    }

    await alert.remove();
    res.deliver(200, 'Removed alert');
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await Alert.find({});
    res.deliver(200, 'Success', alerts);
  } catch (error) {
    console.log(error);
    next(new NotFoundError('Alerts not found'));
  }
};
