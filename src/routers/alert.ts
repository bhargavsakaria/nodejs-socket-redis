import express from 'express';
import tokenVerify from '../middlewares/tokenVerify';
import rootAccount from '../middlewares/rootAccount';
import { createAlert, deleteAlert, getAlerts } from '../controllers/alert';
import adminWrite from '../middlewares/adminWrite';

const router = express.Router();
router.use(express.json());
router.put('/', tokenVerify, adminWrite, rootAccount, createAlert);
router.delete('/:id', tokenVerify, adminWrite, rootAccount, deleteAlert);
router.get('/', getAlerts);

export default router;
