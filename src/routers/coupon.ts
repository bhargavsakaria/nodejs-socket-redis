import express from 'express';
import tokenVerify from '../middlewares/tokenVerify';
import rootAccount from '../middlewares/rootAccount';
import admin from '../middlewares/admin';
import { createCoupon, deleteCoupon, getCoupons, verifyCoupon } from '../controllers/coupon';
import adminWrite from '../middlewares/adminWrite';

const router = express.Router();
router.use(express.json());
router.put('/', tokenVerify, adminWrite, rootAccount, createCoupon);
router.get('/', tokenVerify, admin, rootAccount, getCoupons);
router.delete('/:id', tokenVerify, adminWrite, rootAccount, deleteCoupon);
router.get('/verify/:id', tokenVerify, verifyCoupon);

export default router;
