import { NextFunction, Request, Response } from 'express';

import { InternalServerError, NotFoundError } from '../helpers/apiError';
import Coupon from '../entities/Coupons.postgres';

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = req.body;
    const newCoupon = Coupon.create({ ...coupon });
    const savedCoupon = await Coupon.save(newCoupon);

    res.deliver(200, 'Success', savedCoupon);
  } catch (error) {
    console.log(error);
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const couponId = parseInt(req.params.id);
    console.log(couponId);
    const coupon = await Coupon.findOne(couponId);
    console.log(coupon);
    if (!coupon) {
      return next(new NotFoundError('Coupon is not found'));
    }

    await coupon.remove();
    res.deliver(200, 'Removed coupon');
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};

export const getCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await Coupon.find({});
    res.deliver(200, 'Success', coupons);
  } catch (error) {
    console.log(error);
    next(new NotFoundError('Coupons not found'));
  }
};

export const verifyCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const couponId = req.params.id;
    console.log(couponId);
    const coupon = await Coupon.findOne({ code: couponId });
    console.log(coupon);
    if (!coupon) {
      return next(new NotFoundError('Coupon is not found'));
    }

    res.deliver(200, 'Success', coupon);
  } catch (error) {
    // @ts-ignore
    next(new InternalServerError(error.message));
  }
};
