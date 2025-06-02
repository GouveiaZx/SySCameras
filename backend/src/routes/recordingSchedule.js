const recordingScheduleController = require('../controllers/recordingSchedule');
const { authenticate, isAdmin, isIntegrator } = require('../middlewares/auth');
const { schedulerAuth } = require('../middlewares/scheduler-auth');

/**
 * Rotas para agendamento de gravação
 * @param {Object} fastify - Instância do Fastify
 */
async function routes(fastify, options) {
  // Listar agendamentos de gravação para uma câmera
  fastify.get(
    '/cameras/:cameraId/schedules',
    { preValidation: [authenticate] },
    recordingScheduleController.getRecordingSchedules
  );
  
  // Criar novo agendamento de gravação
  fastify.post(
    '/cameras/:cameraId/schedules',
    { preValidation: [authenticate, isIntegrator] },
    recordingScheduleController.createRecordingSchedule
  );
  
  // Atualizar agendamento existente
  fastify.put(
    '/schedules/:scheduleId',
    { preValidation: [authenticate, isIntegrator] },
    recordingScheduleController.updateRecordingSchedule
  );
  
  // Excluir agendamento
  fastify.delete(
    '/schedules/:scheduleId',
    { preValidation: [authenticate, isIntegrator] },
    recordingScheduleController.deleteRecordingSchedule
  );
  
  // Endpoint para verificar agendamentos ativos (usado pelo worker)
  fastify.get(
    '/schedules/check-active',
    { preValidation: [schedulerAuth] },
    recordingScheduleController.checkActiveSchedules
  );
}

module.exports = routes; 