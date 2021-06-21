import { Router } from 'express';
import { getInfo, getAllUsers, getUserById} from '../controllers/user';
import authMiddleware from '../middleware/auth';
import authAdminMiddleware from '../middleware/admin';

const router = Router();

router.get(
  '/getInfo',
  authMiddleware,
  getInfo
);

router.get(
  '/admin/getAllUsers',
  authMiddleware,
  authAdminMiddleware,
  getAllUsers
);

router.get(
  '/admin/getUserById/:id',
  authMiddleware,
  authAdminMiddleware,
  getUserById
);

export default router;
