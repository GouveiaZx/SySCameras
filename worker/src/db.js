require('dotenv').config();
const { supabase } = require('./services/supabase');

/**
 * Obtém todas as câmeras ativas do sistema
 * @returns {Promise<Array>} Lista de câmeras ativas
 */
async function fetchActiveCameras() {
  try {
    // Busca câmeras diretamente no banco que estejam online
    const { data: cameras, error } = await supabase
      .from('cameras')
      .select(`
        *,
        clients:clientId (id, name),
        integrators:integratorId (id, name),
        retention_settings (days)
      `)
      .eq('status', 'online');
    
    if (error) {
      throw error;
    }
    
    console.log(`Encontradas ${cameras.length} câmeras ativas`);
    return cameras;
  } catch (error) {
    console.error('Erro ao buscar câmeras ativas:', error);
    throw error;
  }
}

/**
 * Salva metadados de uma gravação no banco de dados
 * @param {Object} recording - Dados da gravação
 * @returns {Promise<Object>} Gravação criada
 */
async function saveRecordingMetadata(recording) {
  try {
    // Salva os metadados da gravação no banco
    const { data: result, error } = await supabase
      .from('recordings')
      .insert([{
        filename: recording.filename,
        url: recording.url,
        date: recording.date,
        duration: recording.duration,
        size: recording.size,
        cameraId: recording.cameraId,
        userId: recording.userId,
        recordingType: recording.recordingType || 'CONTINUOUS'
      }])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log(`Metadados da gravação salvos com sucesso: ${result.id}`);
    return result;
  } catch (error) {
    console.error('Erro ao salvar metadados da gravação:', error);
    throw error;
  }
}

/**
 * Busca os agendamentos ativos de gravação
 * @returns {Promise<Array>} Agendamentos ativos
 */
async function getActiveSchedules() {
  try {
    // Para agora, retorna array vazio já que não temos agendamentos implementados
    // Futuramente pode buscar de uma tabela de agendamentos
    return [];
  } catch (error) {
    console.error('Erro ao buscar agendamentos ativos:', error);
    throw error;
  }
}

/**
 * Obtém configurações de detecção de movimento para uma câmera
 * @param {string} cameraId - ID da câmera
 * @returns {Promise<Object>} Configurações de detecção de movimento
 */
async function getMotionDetectionConfig(cameraId) {
  try {
    const { data: config, error } = await supabase
      .from('motion_detection_configs')
      .select('*')
      .eq('cameraId', cameraId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    return config;
  } catch (error) {
    console.error(`Erro ao buscar configuração de detecção de movimento para câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Obtém configurações de retenção para uma câmera
 * @param {string} cameraId - ID da câmera
 * @returns {Promise<Object>} Configurações de retenção
 */
async function getRetentionSettings(cameraId) {
  try {
    const { data: settings, error } = await supabase
      .from('retention_settings')
      .select('*')
      .eq('cameraId', cameraId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    return settings || { days: 7 }; // Padrão: 7 dias
  } catch (error) {
    console.error(`Erro ao buscar configurações de retenção para câmera ${cameraId}:`, error);
    return { days: 7 }; // Retorna padrão em caso de erro
  }
}

/**
 * Busca gravações que excederam o período de retenção
 * @returns {Promise<Array>} Gravações expiradas
 */
async function getExpiredRecordings() {
  try {
    // Busca todas as câmeras com suas configurações de retenção
    const { data: cameras, error: camerasError } = await supabase
      .from('cameras')
      .select(`
        id,
        retention_settings (days)
      `);
    
    if (camerasError) {
      throw camerasError;
    }
    
    const expiredRecordings = [];
    
    // Para cada câmera, busca gravações expiradas
    for (const camera of cameras) {
      const retentionDays = camera.retention_settings?.[0]?.days || 7; // Padrão: 7 dias
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const { data: recordings, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('cameraId', camera.id)
        .lt('date', cutoffDate.toISOString());
      
      if (error) {
        console.error(`Erro ao buscar gravações expiradas para câmera ${camera.id}:`, error);
        continue;
      }
      
      expiredRecordings.push(...recordings);
    }
    
    return expiredRecordings;
  } catch (error) {
    console.error('Erro ao buscar gravações expiradas:', error);
    throw error;
  }
}

/**
 * Atualiza status de uma câmera
 * @param {string} cameraId - ID da câmera
 * @param {string} status - Novo status ('online' ou 'offline')
 */
async function updateCameraStatus(cameraId, status) {
  try {
    const { error } = await supabase
      .from('cameras')
      .update({ 
        status,
        updatedAt: new Date().toISOString()
      })
      .eq('id', cameraId);
    
    if (error) {
      throw error;
    }
    
    console.log(`Status da câmera ${cameraId} atualizado para ${status}`);
  } catch (error) {
    console.error(`Erro ao atualizar status da câmera ${cameraId}:`, error);
    throw error;
  }
}

module.exports = {
  fetchActiveCameras,
  saveRecordingMetadata,
  getActiveSchedules,
  getMotionDetectionConfig,
  getRetentionSettings,
  getExpiredRecordings,
  updateCameraStatus
}; 