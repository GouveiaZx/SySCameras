const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';

/**
 * Serviço para comunicação com o worker de streaming
 */
class WorkerStreamingService {
  
  /**
   * Inicia stream HLS para uma câmera
   * @param {string} cameraId - ID da câmera
   * @returns {Promise<Object>} Resultado da operação
   */
  async startStream(cameraId) {
    try {
      console.log(`🎬 Solicitando início de stream para câmera ${cameraId}`);
      
      const response = await fetch(`${WORKER_URL}/api/streams/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cameraId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao iniciar stream');
      }

      console.log(`✅ Stream iniciado com sucesso para câmera ${cameraId}`);
      return result;

    } catch (error) {
      console.error(`❌ Erro ao solicitar início de stream [${cameraId}]:`, error);
      throw error;
    }
  }

  /**
   * Para stream HLS de uma câmera
   * @param {string} cameraId - ID da câmera
   * @returns {Promise<Object>} Resultado da operação
   */
  async stopStream(cameraId) {
    try {
      console.log(`🛑 Solicitando parada de stream para câmera ${cameraId}`);
      
      const response = await fetch(`${WORKER_URL}/api/streams/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cameraId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao parar stream');
      }

      console.log(`✅ Stream parado com sucesso para câmera ${cameraId}`);
      return result;

    } catch (error) {
      console.error(`❌ Erro ao solicitar parada de stream [${cameraId}]:`, error);
      throw error;
    }
  }

  /**
   * Obtém status de um stream
   * @param {string} cameraId - ID da câmera
   * @returns {Promise<Object>} Status do stream
   */
  async getStreamStatus(cameraId) {
    try {
      const response = await fetch(`${WORKER_URL}/api/streams/${cameraId}/status`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao obter status do stream');
      }

      return result;

    } catch (error) {
      console.error(`❌ Erro ao obter status do stream [${cameraId}]:`, error);
      throw error;
    }
  }

  /**
   * Lista todos os streams ativos
   * @returns {Promise<Object>} Lista de streams ativos
   */
  async getActiveStreams() {
    try {
      const response = await fetch(`${WORKER_URL}/api/streams/active`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao listar streams ativos');
      }

      return result;

    } catch (error) {
      console.error('❌ Erro ao listar streams ativos:', error);
      throw error;
    }
  }

  /**
   * Obtém status geral do worker
   * @returns {Promise<Object>} Status do worker
   */
  async getWorkerStatus() {
    try {
      const response = await fetch(`${WORKER_URL}/api/worker/status`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao obter status do worker');
      }

      return result;

    } catch (error) {
      console.error('❌ Erro ao obter status do worker:', error);
      throw error;
    }
  }

  /**
   * Inicia streams automáticos para todas as câmeras online
   * @returns {Promise<Object>} Resultado da operação
   */
  async autoStartStreams() {
    try {
      console.log('🎬 Solicitando início de streams automáticos');
      
      const response = await fetch(`${WORKER_URL}/api/auto-start-streams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao iniciar streams automáticos');
      }

      console.log('✅ Streams automáticos solicitados com sucesso');
      return result;

    } catch (error) {
      console.error('❌ Erro ao solicitar streams automáticos:', error);
      throw error;
    }
  }

  /**
   * Verifica se o worker está disponível
   * @returns {Promise<boolean>} true se o worker estiver disponível
   */
  async isWorkerAvailable() {
    try {
      const response = await fetch(`${WORKER_URL}/health`, {
        timeout: 5000
      });
      
      return response.ok;

    } catch (error) {
      console.error('❌ Worker não está disponível:', error);
      return false;
    }
  }

  /**
   * Inicia stream HLS para uma câmera com URL específica
   * @param {string} cameraId - ID da câmera
   * @param {string} streamUrl - URL da câmera (RTSP ou RTMP)
   * @param {Object} options - Opções do stream (quality, protocol, etc.)
   * @returns {Promise<Object>} Resultado da operação
   */
  async startStreamWithUrl(cameraId, streamUrl, options = {}) {
    try {
      console.log(`🎬 Solicitando início de stream para câmera ${cameraId} com URL específica`);
      console.log(`📡 URL: ${streamUrl}`);
      console.log(`⚙️ Opções:`, options);
      
      const response = await fetch(`${WORKER_URL}/api/streams/start-with-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cameraId, 
          streamUrl,
          options
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao iniciar stream');
      }

      console.log(`✅ Stream iniciado com sucesso para câmera ${cameraId}`);
      return result;

    } catch (error) {
      console.error(`❌ Erro ao solicitar início de stream [${cameraId}]:`, error);
      throw error;
    }
  }
}

// Singleton instance
const workerStreamingService = new WorkerStreamingService();

module.exports = workerStreamingService; 