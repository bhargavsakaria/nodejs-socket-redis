import express from 'express';

import { getUser, userLogin } from '../controllers/login';
import tokenVerify from '../middlewares/tokenVerify';

const router = express.Router();

router.get('/user', express.json(), tokenVerify, getUser);
router.post('/login', express.json(), userLogin);

export default router;
