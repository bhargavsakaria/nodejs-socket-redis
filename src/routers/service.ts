import express from 'express';

import { createService, deleteService, getServices } from '../controllers/service';
import tokenVerify from '../middlewares/tokenVerify';
import rootAccount from '../middlewares/rootAccount';
import adminWrite from '../middlewares/adminWrite';

const router = express.Router();
router.use(express.json());
router.put('/', tokenVerify, adminWrite, rootAccount, createService);
router.delete('/:id', tokenVerify, adminWrite, rootAccount, deleteService);
router.get('/', getServices);

export default router;
