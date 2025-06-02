const motionDetectionController = require('../controllers/motionDetection');
const { authenticate, isIntegrator } = require('../middlewares/auth');

/**
 * Rotas para configuração de detecção de movimento
 * @param {Object} fastify - Instância do Fastify
 */
async function routes(fastify, options) {
  // Obter configuração de detecção de movimento para uma câmera
  fastify.get(
    '/cameras/:cameraId/motion-detection',
    { preValidation: [authenticate] },
    motionDetectionController.getMotionDetectionConfig
  );
  
  // Criar ou atualizar configuração de detecção de movimento
  fastify.post(
    '/cameras/:cameraId/motion-detection',
    { preValidation: [authenticate, isIntegrator] },
    motionDetectionController.saveMotionDetectionConfig
  );
  
  // Endpoint para receber notificações de movimento detectado (usado pelo worker)
  fastify.post(
    '/cameras/:cameraId/motion-detected',
    motionDetectionController.handleMotionDetected
  );
}

module.exports = routes; 