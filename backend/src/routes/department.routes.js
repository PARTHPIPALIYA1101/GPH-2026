import { Router } from 'express';
import { getDepartments, getDepartmentById, createNewDepartment } from '../controllers/department.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const departmentRouter = Router();

departmentRouter.use(authenticate);

departmentRouter.get('/', getDepartments);
departmentRouter.get('/:id', getDepartmentById);
departmentRouter.post('/', createNewDepartment);
