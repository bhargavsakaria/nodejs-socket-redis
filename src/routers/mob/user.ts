import express from 'express';
import mobileTokenVerify from '../../middlewares/mob/mobileTokenVerify';
import * as user from '../../controllers/mob/user';
import {
  autoAnswerValidationMidware,
  getLatestVersionValidatorMidware,
  versionUpdateValidatorMidware
} from '../../middlewares/mob/mobRequestValidator';

const router = express.Router();

router.get('/missed-calls', mobileTokenVerify, user.missedCalls);
router.post('/auto-answer', mobileTokenVerify, autoAnswerValidationMidware, user.changeAutoAnswerStatus);
router.post('/notification-check', user.notificationFirebaseCheck);
router.get('/auto-answer', mobileTokenVerify, user.getAutoAnswerStatus);
router.get('/notifications', mobileTokenVerify, user.getNotifications);
router.get('/reset-application', mobileTokenVerify, user.resetApplication);

/* AWS Image upload/retrieve operation endpoints */
router.post('/profile/upload-profile-image', mobileTokenVerify, user.updateProfileImage);
router.get('/profile/url', mobileTokenVerify, user.getProfileImageUrl);

/* App version information endpoints */
router.post('/version/update', versionUpdateValidatorMidware, user.updateAppVersion);

router.post('/version/latest', getLatestVersionValidatorMidware, user.latestAppVersion);

export default router;
