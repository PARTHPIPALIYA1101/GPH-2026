import { Router } from 'express';
import {
  getCameras,
  getCamera,
  getSummary,
  getMap,
  registerNewCamera,
  updateCameraInfo,
  decommissionCamera
} from '../controllers/camera.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const cameraRouter = Router();

cameraRouter.use(authenticate);

cameraRouter.get('/', getCameras);
cameraRouter.get('/summary', getSummary);
cameraRouter.get('/map', getMap);
cameraRouter.get('/:id', getCamera);
cameraRouter.post('/', registerNewCamera);
cameraRouter.patch('/:id', updateCameraInfo);
cameraRouter.delete('/:id', decommissionCamera);

