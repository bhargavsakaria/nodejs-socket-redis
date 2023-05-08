import { NextFunction, Request, Response } from 'express';

import { InternalServerError, NotFoundError } from '../helpers/apiError';
import Service from '../entities/Service.postgres';

// TODO: only for admin
export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = req.body;
    const newService = Service.create({ ...service });
    const savedService = await Service.save(newService);

    res.deliver(200, 'Success', savedService);
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

// TODO: only for admin
export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceId = parseInt(req.params.id);
    console.log(serviceId);
    const service = await Service.findOne(serviceId);
    console.log(service);
    if (!service) {
      return next(new NotFoundError('Service is not found'));
    }

    await service.remove();
    res.deliver(200, 'Removed service');
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await Service.find({});
    res.deliver(200, 'Success', services);
  } catch (error) {
    console.log(error);
    next(new NotFoundError('Services not found'));
  }
};

// TODO: update service and delete service
