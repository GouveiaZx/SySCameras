import userRoutes from './routes/user-routes';
import cameraRoutes from './routes/camera-routes';
import streamRoutes from './routes/stream-routes';
import recordingRoutes from './routes/recording-routes';
import alertRoutes from './routes/alert-routes';
import adminRoutes from './routes/admin-routes';

// Registrar rotas
await userRoutes(app);
await cameraRoutes(app);
await streamRoutes(app);
await recordingRoutes(app);
await alertRoutes(app);
await adminRoutes(app); 