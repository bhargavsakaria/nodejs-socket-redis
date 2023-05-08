import express from 'express';
import * as auth from '../../controllers/mob/auth';
import mobileTokenVerify from '../../middlewares/mob/mobileTokenVerify';
import { loginValidationMidware } from '../../middlewares/mob/mobRequestValidator';

const router = express.Router();

router.post('/login', loginValidationMidware, auth.login);
router.post('/logout', mobileTokenVerify, auth.logout);
router.get('/send-reset-password-link', mobileTokenVerify, auth.sendResetPasswordLink);

export default router;
