import express from 'express';
import tokenVerify from '../middlewares/tokenVerify';
import rootAccount from '../middlewares/rootAccount';
import admin from '../middlewares/admin';
import { createBlog, deleteBlog, getBlogs } from '../controllers/blog';
import adminWrite from '../middlewares/adminWrite';

const router = express.Router();
router.use(express.json());
router.put('/', tokenVerify, adminWrite, rootAccount, createBlog);
router.get('/', tokenVerify, admin, rootAccount, getBlogs);
router.delete('/:id', tokenVerify, adminWrite, rootAccount, deleteBlog);

export default router;
