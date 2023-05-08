import express, { Request, Response, NextFunction } from 'express';

import tokenVerify from '../middlewares/tokenVerify';
import rootAccount from '../middlewares/rootAccount';
import admin from '../middlewares/admin';
import {
  addGroupMember,
  createGroup,
  createOrder,
  deleteGroup,
  deleteOrder,
  deleteUser,
  getAllOrders,
  getUsers,
  pointsByZip,
  registerUser,
  updateOrder,
  updateUser,
  staffRequestInvite,
  addStaffInvite,
  staffListing,
  assignedSeniorToStaff,
  editNurseProfile,
  getAllSeniors,
  staffInfo,
  editMemberProfile,
  editSeniorProfile,
  getAllCustomers,
  getSeniorAssignedNurses,
  getCustomerData
} from '../controllers/user';
import adminWrite from '../middlewares/adminWrite';

const router = express.Router();

router.use(express.json());

router.post('/root', registerUser);
router.patch('/', tokenVerify, updateUser);
router.delete('/:id', tokenVerify, adminWrite, deleteUser);
router.get('/all', tokenVerify, admin, getUsers);
router.post('/group', tokenVerify, rootAccount, createGroup);
router.patch('/group/:id', tokenVerify, rootAccount, addGroupMember);
router.delete('/group/:id', tokenVerify, rootAccount, deleteGroup);
router.post('/orders', tokenVerify, rootAccount, createOrder);
router.get('/orders/points', pointsByZip);
router.get('/orders/all', tokenVerify, admin, rootAccount, getAllOrders);
router.patch('/orders/:id', tokenVerify, adminWrite, rootAccount, updateOrder);
router.delete('/orders/:id', tokenVerify, adminWrite, rootAccount, deleteOrder);

/* Staff routes */
router.post('/staff/request-invite', tokenVerify, admin, staffRequestInvite);
router.post('/staff/add-staff', tokenVerify, admin, addStaffInvite);
router.get('/staff/seniors-lists', tokenVerify, admin, getAllSeniors);
router.get('/staff/assigned-senior', tokenVerify, admin, assignedSeniorToStaff);
router.get('/staff/list/:role', tokenVerify, admin, staffListing);
router.get('/staff/:id', tokenVerify, admin, staffInfo);
router.post('/staff/edit-profile', tokenVerify, admin, editNurseProfile);

/* Member - Senior routes */
router.post('/customers', tokenVerify, admin, getAllCustomers);
router.get('/customer-detail/:id', tokenVerify, admin, getCustomerData);
router.post('/member/edit-profile', tokenVerify, admin, editMemberProfile);
router.post('/senior/edit-profile', tokenVerify, admin, editSeniorProfile);
router.post('/senior/assigned-nurse', tokenVerify, admin, getSeniorAssignedNurses);
export default router;
