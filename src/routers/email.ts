import express from 'express';

import * as emailController from '../controllers/email';
import tokenVerify from '../middlewares/tokenVerify';

const router = express.Router();
router.use(express.json());

// user sends reset form data
router.post('/reset-password/user/:username', emailController.sendPasswordResetEmail);
// user sends new password form data
router.post('/new-password/:userId/:token', emailController.receiveNewPassword);
router.post('/customer', tokenVerify, emailController.sendEmailCustomer);
router.post('/member', emailController.sendEmailMember);
router.post('/contact', emailController.contactEmail);

export default router;
