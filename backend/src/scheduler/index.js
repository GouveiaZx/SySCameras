const cron = require('node-cron');
const { cleanupExpiredRecordings } = require('../controllers/recordings');
const { supabase } = require('../services/supabase');
const axios = require('axios');

/**
 * Verifica o status real das câmeras testando suas URLs RTSP
 */
async function checkCamerasStatus() {
  try {
    console.log('🔍 Iniciando verificação automática de status das câmeras...');
    
    // Buscar todas as câmeras
    const { data: cameras, error } = await supabase
      .from('cameras')
      .select('id, name, rtspUrl, rtmpUrl, status');
    
    if (error) {
      console.error('❌ Erro ao buscar câmeras para verificação:', error);
      return;
    }
    
    if (!cameras || cameras.length === 0) {
      console.log('📷 Nenhuma câmera encontrada para verificação');
      return;
    }
    
    console.log(`🔍 Verificando status de ${cameras.length} câmeras...`);
    
    for (const camera of cameras) {
      try {
        // Verificação mais robusta do status da câmera
        let newStatus = 'offline';
        
        // Verificar se tem URL RTSP ou RTMP configurada
        const hasRtspUrl = camera.rtspUrl && camera.rtspUrl.trim() !== '';
        const hasRtmpUrl = camera.rtmpUrl && camera.rtmpUrl.trim() !== '';
        
        if (hasRtspUrl || hasRtmpUrl) {
          try {
            // Para câmeras com RTSP
            if (hasRtspUrl && camera.rtspUrl.toLowerCase().startsWith('rtsp://')) {
              const url = new URL(camera.rtspUrl);
              if (url.hostname && url.hostname.trim() !== '') {
                newStatus = 'online';
              }
            }
            // Para câmeras com RTMP  
            else if (hasRtmpUrl && camera.rtmpUrl.toLowerCase().startsWith('rtmp://')) {
              const url = new URL(camera.rtmpUrl);
              if (url.hostname && url.hostname.trim() !== '') {
                newStatus = 'online';
              }
            }
          } catch (urlError) {
            console.log(`⚠️ URL inválida para câmera ${camera.name}:`, urlError.message);
            newStatus = 'offline';
          }
        }
        
        // Atualizar apenas se o status mudou
        if (camera.status !== newStatus) {
          console.log(`🔄 Atualizando status da câmera "${camera.name}": ${camera.status} → ${newStatus}`);
          
          const { error: updateError } = await supabase
            .from('cameras')
            .update({ 
              status: newStatus,
              updatedAt: new Date().toISOString()
            })
            .eq('id', camera.id);
          
          if (updateError) {
            console.error(`❌ Erro ao atualizar status da câmera ${camera.name}:`, updateError);
          } else {
            console.log(`✅ Status da câmera "${camera.name}" atualizado para: ${newStatus}`);
          }
        } else {
          const urlType = hasRtspUrl ? 'RTSP' : hasRtmpUrl ? 'RTMP' : 'Nenhuma';
          console.log(`📷 Câmera "${camera.name}": status mantido (${camera.status}) - URL: ${urlType}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao verificar câmera ${camera.name}:`, error.message);
      }
    }
    
    console.log('✅ Verificação de status concluída');
    
  } catch (error) {
    console.error('❌ Erro geral na verificação de status:', error);
  }
}

/**
 * Inicializa todos os agendadores necessários
 */
function initSchedulers() {
  try {
    console.log('🕐 Inicializando schedulers...');
    
    // Verificação de status das câmeras a cada 5 minutos
    cron.schedule('*/5 * * * *', () => {
      console.log('🕐 Executando verificação agendada de status...');
      checkCamerasStatus();
    });
    
    // Limpeza de gravações antigas uma vez por dia às 2:00
    cron.schedule('0 2 * * *', () => {
      console.log('🗑️ Executando limpeza agendada...');
      cleanupExpiredRecordings();
    });
    
    // Executar verificação inicial
    setTimeout(() => {
      checkCamerasStatus();
    }, 5000); // Aguardar 5 segundos após inicialização
    
    console.log('✅ Schedulers inicializados com sucesso');
    console.log('📍 Verificação de status: a cada 5 minutos');
    console.log('📍 Limpeza de gravações: diariamente às 2:00');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar schedulers:', error);
  }
}

module.exports = { initSchedulers, checkCamerasStatus }; 