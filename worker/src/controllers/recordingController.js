const { listActiveRecordings, getRecordingStats } = require('../recording-service');

class RecordingController {
  /**
   * Inicia gravação de uma câmera
   */
  async startRecording(req, res) {
    try {
      const { cameraId, rtspUrl, duration } = req.body;

      if (!cameraId || !rtspUrl) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'cameraId e rtspUrl são obrigatórios'
        });
      }

      const result = await recordingService.startRecording(
        cameraId,
        rtspUrl,
        duration || 300
      );

      res.json({
        message: 'Gravação iniciada com sucesso',
        ...result
      });

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  }

  /**
   * Para gravação ativa
   */
  async stopRecording(req, res) {
    try {
      const { cameraId } = req.params;

      if (!cameraId) {
        return res.status(400).json({
          error: 'Parâmetro obrigatório',
          message: 'cameraId é obrigatório'
        });
      }

      const result = await recordingService.stopRecording(cameraId);

      res.json({
        message: 'Gravação parada com sucesso',
        ...result
      });

    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  }

  /**
   * Lista gravações ativas
   */
  async getActiveRecordings(req, res) {
    try {
      const activeRecordings = listActiveRecordings();
      const stats = getRecordingStats();

      res.json({
        count: stats.activeRecordings,
        recordings: activeRecordings.map(cameraId => ({
          cameraId,
          status: 'RECORDING',
          type: 'CONTINUOUS'
        }))
      });

    } catch (error) {
      console.error('Erro ao listar gravações:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  }

  /**
   * Agenda gravação automática
   */
  async scheduleRecording(req, res) {
    try {
      const { cameraId, rtspUrl, schedule } = req.body;

      if (!cameraId || !rtspUrl || !schedule) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'cameraId, rtspUrl e schedule são obrigatórios'
        });
      }

      const result = await recordingService.scheduleRecording(
        cameraId,
        rtspUrl,
        schedule
      );

      res.json({
        message: 'Agendamento configurado com sucesso',
        ...result
      });

    } catch (error) {
      console.error('Erro ao agendar gravação:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  }

  /**
   * Status do worker
   */
  async getStatus(req, res) {
    try {
      const activeRecordings = recordingService.getActiveRecordings();

      res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        activeRecordings: activeRecordings.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });

    } catch (error) {
      console.error('Erro ao obter status:', error);
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  }
}

module.exports = new RecordingController(); 