require('dotenv').config();
const cron = require('node-cron');
const { fetchActiveCameras, getActiveSchedules } = require('./db');
const { cleanupExpiredRecordings } = require('./cleanup');
const { startContinuousRecording, handleScheduledRecordings, getRecordingStats } = require('./recording-service');
// const { setupMotionDetectionForAllCameras } = require('./motion-detector'); // Comentado temporariamente

// Iniciar servidor de streaming
const app = require('./server');

console.log('🚀 Iniciando worker de processamento de câmeras IP...');

// Inicia processamento RTSP para MP4 e upload para Wasabi
async function startProcessing() {
  try {
    console.log('🔍 Buscando câmeras ativas para processamento...');
    const cameras = await fetchActiveCameras();
    
    if (cameras.length === 0) {
      console.log('📱 Nenhuma câmera ativa encontrada.');
      return;
    }
    
    console.log(`🎥 Encontradas ${cameras.length} câmeras ativas`);
    console.log('⚠️ Auto-start de gravações DESABILITADO - use a interface web para iniciar gravações');
    
    // ❌ DESABILITADO: Auto-start de gravações contínuas
    // Agora as gravações devem ser iniciadas manualmente via interface web
    /*
    for (const camera of cameras) {
      // Inicia processamento para cada câmera em paralelo
      startContinuousRecording(camera)
        .catch(err => console.error(`❌ Erro ao processar câmera ${camera.id}: ${err.message}`));
    }
    */
    
    // Configura detecção de movimento para câmeras que possuem essa configuração
    // await setupMotionDetectionForAllCameras(cameras);
    
  } catch (error) {
    console.error('❌ Erro ao iniciar processamento de câmeras:', error);
  }
}

// Verifica agendamentos de gravação
async function checkSchedules() {
  try {
    console.log('📅 Verificando agendamentos de gravação...');
    const schedules = await getActiveSchedules();
    
    // Processa gravações agendadas
    await handleScheduledRecordings(schedules);
    
  } catch (error) {
    console.error('❌ Erro ao verificar agendamentos de gravação:', error);
  }
}

// Inicia limpeza de gravações expiradas
async function startCleanup() {
  try {
    console.log('🧹 Iniciando limpeza de gravações expiradas...');
    const stats = await cleanupExpiredRecordings();
    console.log('✅ Limpeza concluída:', stats);
  } catch (error) {
    console.error('❌ Erro durante a limpeza de gravações:', error);
  }
}

// Auto-iniciar streams HLS para câmeras online
async function autoStartStreams() {
  try {
    console.log('🎬 Iniciando streams automáticos para câmeras online...');
    
    const streamingService = require('./services/streamingService');
    const { supabase } = require('./services/supabase');
    
    // Buscar câmeras online com RTSP ou RTMP
    const { data: cameras, error } = await supabase
      .from('cameras')
      .select('id, name, rtspUrl, rtmpUrl, status')
      .eq('status', 'online')
      .or('rtspUrl.not.is.null,rtmpUrl.not.is.null');

    if (error) {
      console.error('❌ Erro ao buscar câmeras para streaming:', error);
      return;
    }

    let successCount = 0;
    
    for (const camera of cameras) {
      try {
        // Verificar se já existe stream ativo
        const streamStatus = streamingService.getStreamStatus(camera.id);
        if (streamStatus.active) {
          console.log(`⚠️ Stream já ativo para câmera ${camera.name} (${camera.id})`);
          continue;
        }

        // Determinar URL de entrada (RTSP ou RTMP)
        const inputUrl = camera.rtspUrl || camera.rtmpUrl;
        const streamType = camera.rtspUrl ? 'RTSP' : 'RTMP';
        
        if (!inputUrl) {
          console.log(`⚠️ Câmera ${camera.name} sem URL de entrada válida`);
          continue;
        }

        console.log(`🎬 Iniciando stream ${streamType} para ${camera.name}: ${inputUrl}`);
        const result = await streamingService.startHLSStream(camera.id, inputUrl);
        
        if (result.success) {
          // Atualizar URL HLS no banco
          await supabase
            .from('cameras')
            .update({ 
              hlsUrl: result.hlsUrl,
              streamStatus: 'ACTIVE'
            })
            .eq('id', camera.id);
          
          successCount++;
          console.log(`✅ Stream HLS iniciado para ${camera.name}: ${result.hlsUrl}`);
        } else {
          console.error(`❌ Falha ao iniciar stream para ${camera.name}: ${result.message}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao iniciar stream para câmera ${camera.name}:`, error);
      }
    }
    
    console.log(`🎯 ${successCount}/${cameras.length} streams HLS iniciados automaticamente`);
    
  } catch (error) {
    console.error('❌ Erro ao iniciar streams automáticos:', error);
  }
}

// Exibe status atual do worker
function displayStatus() {
  const recordingStats = getRecordingStats();
  const streamingService = require('./services/streamingService');
  const activeStreams = streamingService.getActiveStreams();
  
  console.log('📊 Status do worker:');
  console.log(`🎥 Gravações ativas: ${recordingStats.activeRecordings}`);
  console.log(`📹 Câmeras em gravação: ${recordingStats.cameras.join(', ') || 'nenhuma'}`);
  console.log(`📺 Streams HLS ativos: ${activeStreams.length}`);
  console.log(`🎬 Câmeras streaming: ${activeStreams.map(s => s.cameraId).join(', ') || 'nenhuma'}`);
  
  // Exibir uso de memória
  const memoryUsage = process.memoryUsage();
  console.log('💾 Uso de memória:');
  console.log(`- RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
  console.log(`- Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`);
}

// ❌ DESABILITADO: Agenda o processamento a cada hora
// const processingJob = cron.schedule('0 * * * *', startProcessing);

// Agenda a verificação de agendamentos a cada minuto
const scheduleCheckJob = cron.schedule('* * * * *', checkSchedules);

// Agenda a limpeza uma vez por dia às 00:00
const cleanupJob = cron.schedule('0 0 * * *', startCleanup);

// Agenda verificação/início de streams a cada 10 minutos
const streamCheckJob = cron.schedule('*/10 * * * *', autoStartStreams);

// Agenda exibição de status a cada 15 minutos
const statusJob = cron.schedule('*/15 * * * *', displayStatus);

// ❌ DESABILITADO: Inicia o processamento imediatamente
// startProcessing();

// Inicia verificação de agendamentos imediatamente
checkSchedules();

// Inicia streams automáticos após 30 segundos (dar tempo para o servidor subir)
setTimeout(autoStartStreams, 30000);

// Exibe informações iniciais
console.log('🟢 Worker de processamento iniciado.');
console.log(`⏰ Processamento agendado a cada hora`);
console.log(`📋 Verificação de agendamentos a cada minuto`);
console.log(`🧹 Limpeza agendada diariamente às 00:00`);
console.log(`🎬 Verificação de streams a cada 10 minutos`);

// Trata eventos de desligamento gracioso
process.on('SIGTERM', async () => {
  console.log('🛑 Recebido sinal SIGTERM, encerrando worker graciosamente...');
  
  // Parar todos os streams ativos
  const streamingService = require('./services/streamingService');
  streamingService.stopAllStreams();
  
  // Aqui você pode adicionar lógica para parar gravações em andamento
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recebido sinal SIGINT, encerrando worker graciosamente...');
  
  // Parar todos os streams ativos
  const streamingService = require('./services/streamingService');
  streamingService.stopAllStreams();
  
  // Aqui você pode adicionar lógica para parar gravações em andamento
  process.exit(0);
});