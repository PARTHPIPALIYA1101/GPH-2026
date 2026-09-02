import { Router } from 'express';
import { getUsers, getUserById, createNewUser, changeUserStatus } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRoles } from '../middleware/authorize.js';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/', requireRoles('STATE_ADMIN', 'DEPARTMENT_HEAD'), getUsers);
userRouter.get('/:id', requireRoles('STATE_ADMIN', 'DEPARTMENT_HEAD'), getUserById);
userRouter.post('/', requireRoles('STATE_ADMIN', 'DEPARTMENT_HEAD'), createNewUser);
userRouter.patch('/:id/status', requireRoles('STATE_ADMIN', 'DEPARTMENT_HEAD'), changeUserStatus);
