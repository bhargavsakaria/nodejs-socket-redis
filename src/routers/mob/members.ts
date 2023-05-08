import express from 'express';
import mobileTokenVerify from '../../middlewares/mob/mobileTokenVerify';
import * as members from '../../controllers/mob/members';
import { paginationValidationMidware } from '../../middlewares/mob/mobRequestValidator';

const router = express.Router();

router.post('/list', mobileTokenVerify, paginationValidationMidware, members.getAssociatedUsers);

export default router;
