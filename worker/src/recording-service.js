require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Para operações síncronas
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { uploadToWasabi } = require('./wasabi');
const { saveRecordingMetadata, updateCameraStatus } = require('./db');
const { spawn } = require('child_process');

// Configurar ffmpeg para usar o binário estático
ffmpeg.setFfmpegPath(ffmpegStatic);

// Configurações
const TMP_DIR = path.join(__dirname, '../tmp');
const SEGMENT_DURATION = parseInt(process.env.SEGMENT_DURATION) || 300; // 5 minutos

console.log(`🔧 Configuração de segmentação: ${SEGMENT_DURATION} segundos (${SEGMENT_DURATION/60} minutos)`);

// Mapa de gravações ativas
const activeRecordings = new Map();

/**
 * Inicializa diretório temporário
 */
async function initTempDirectory() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
    console.log(`Diretório temporário criado: ${TMP_DIR}`);
  } catch (error) {
    console.error('Erro ao criar diretório temporário:', error);
  }
}

// Inicializar diretório temporário na inicialização
initTempDirectory();

/**
 * Inicia gravação contínua para uma câmera
 * @param {Object} camera - Dados da câmera
 * @returns {Promise<Object>} Resultado da operação
 */
async function startContinuousRecording(camera) {
  try {
    // Verificar se já existe uma gravação ativa para esta câmera
    if (activeRecordings.has(camera.id)) {
      console.log(`Gravação já está em execução para câmera: ${camera.id}`);
      return { success: true, message: 'Gravação já está em execução' };
    }

    console.log(`Iniciando gravação contínua para câmera: ${camera.id} (${camera.name})`);

    // Criar diretório temporário para esta câmera
    const cameraDir = path.join(TMP_DIR, `camera_${camera.id}`);
    try {
      await fs.mkdir(cameraDir, { recursive: true });
    } catch (error) {
      console.log(`Diretório ${cameraDir} já existe ou erro ao criar:`, error);
    }

    // Estado do processo de gravação
    const recordingProcess = {
      isActive: true,
      currentSegment: null,
      segmentStartTime: null,
      stopRequested: false
    };

    // Armazenar referência do processo
    activeRecordings.set(camera.id, recordingProcess);

    // Iniciar o primeiro segmento
    startNextSegment(camera, recordingProcess);

    return { success: true, message: 'Gravação contínua iniciada' };
  } catch (error) {
    console.error(`Erro ao iniciar gravação contínua para câmera ${camera.id}:`, error);
    throw error;
  }
}

/**
 * Inicia a gravação de um novo segmento de vídeo
 */
async function startNextSegment(camera, recordingProcess) {
  if (recordingProcess.stopRequested) {
    recordingProcess.isActive = false;
    activeRecordings.delete(camera.id);
    console.log(`Gravação contínua encerrada para câmera ${camera.id} devido a pedido de parada`);
    return;
  }

  try {
    // Gerar timestamp para o nome do arquivo
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    
    // Criar nome do arquivo
    const filename = `client${camera.clientId}_cam${camera.id}_${timestamp}.mp4`;
    const outputPath = path.join(TMP_DIR, `camera_${camera.id}`, filename);
    
    // Registrar horário de início do segmento
    recordingProcess.segmentStartTime = now;
    
    // Determinar URL de entrada (RTSP ou RTMP)
    const inputUrl = camera.rtspUrl || camera.rtmpUrl;
    const inputType = camera.rtspUrl ? 'RTSP' : 'RTMP';
    
    if (!inputUrl) {
      throw new Error(`Câmera ${camera.id} não possui URL RTSP ou RTMP configurada`);
    }
    
    console.log(`📹 Gravando segmento ${inputType}: ${filename}`);
    
    // Montar comando FFmpeg para gravar segmento (adaptado para RTSP/RTMP)
    let ffmpegArgs;
    
    if (camera.rtspUrl) {
      // Para RTSP - Com recodificação para garantir compatibilidade
      ffmpegArgs = [
        '-i', camera.rtspUrl,
        '-t', SEGMENT_DURATION.toString(),
        '-c:v', 'libx264',         // Força H.264
        '-preset', 'ultrafast',    // Velocidade de codificação
        '-crf', '23',              // Qualidade
        '-pix_fmt', 'yuv420p',     // Formato de pixel compatível
        '-c:a', 'aac',
        '-b:a', '128k',            // Bitrate de áudio
        '-f', 'mp4',
        '-rtsp_transport', 'tcp',
        '-movflags', '+faststart', // Para streaming web
        outputPath
      ];
    } else {
      // Para RTMP - Com recodificação para garantir compatibilidade
      ffmpegArgs = [
        '-i', camera.rtmpUrl,
        '-t', SEGMENT_DURATION.toString(),
        '-c:v', 'libx264',         // Força H.264
        '-preset', 'ultrafast',    // Velocidade de codificação
        '-crf', '23',              // Qualidade
        '-pix_fmt', 'yuv420p',     // Formato de pixel compatível
        '-c:a', 'aac',
        '-b:a', '128k',            // Bitrate de áudio
        '-f', 'mp4',
        '-movflags', '+faststart', // Para streaming web
        outputPath
      ];
    }

    // Iniciar processo FFmpeg
    const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs);
    recordingProcess.currentSegment = {
      filename,
      outputPath,
      process: ffmpegProcess,
      startTime: now
    };
    
    console.log(`Iniciando gravação de segmento: ${filename}`);

    // Timeout para forçar finalização após duração + margem
    const timeoutMs = (SEGMENT_DURATION + 60) * 1000; // +60s de margem
    const segmentTimeout = setTimeout(async () => {
      console.log(`⏰ Timeout atingido para segmento ${filename}, forçando finalização...`);
      
      if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGTERM');
        
        // Aguardar um pouco e processar o arquivo se existir
        setTimeout(async () => {
          await processSegmentFile(outputPath, filename, recordingProcess, camera);
        }, 3000);
      }
    }, timeoutMs);

    // Monitorar encerramento do processo
    ffmpegProcess.on('close', async (code) => {
      clearTimeout(segmentTimeout);
      console.log(`Segmento finalizado: ${filename} com código: ${code}`);
      
      await processSegmentFile(outputPath, filename, recordingProcess, camera, code);
    });
  } catch (error) {
    console.error(`Erro ao iniciar segmento para câmera ${camera.id}:`, error);
    
    // Tentar novamente após um intervalo
    setTimeout(() => {
      if (recordingProcess.isActive) {
        startNextSegment(camera, recordingProcess);
      }
    }, 5000);
  }
}

/**
 * Processa um arquivo de segmento (upload e salvamento)
 */
async function processSegmentFile(outputPath, filename, recordingProcess, camera, exitCode = null) {
  try {
    // Verificar se o arquivo existe e tem tamanho razoável
    if (!fsSync.existsSync(outputPath)) {
      console.log(`❌ Arquivo não encontrado: ${outputPath}`);
      return;
    }
    
    const fileStats = await fs.stat(outputPath);
    const fileSize = fileStats.size;
    
    console.log(`📊 Processando segmento: ${filename} (${Math.round(fileSize / 1024 / 1024)}MB)`);
    
    // Só processar se o arquivo tem tamanho razoável (>100KB)
    if (fileSize < 100000) {
      console.log(`⚠️ Arquivo muito pequeno (${fileSize} bytes), ignorando: ${filename}`);
      return;
    }
    
    // Se o processo terminou normalmente OU se o arquivo é grande o suficiente, fazer upload
    if (exitCode === 0 || fileSize > 1000000) { // >1MB considera como válido
      try {
        console.log(`💾 Processando segmento: ${filename}`);
        
        // Gerar URL correta do worker para servir o arquivo
        const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3002';
        const relativePath = `camera_${camera.id}/${filename}`;
        const fileUrl = `${WORKER_URL}/api/recordings/stream/${relativePath}`;
        const downloadUrl = `${WORKER_URL}/api/recordings/download/${camera.id}/${filename}`;
        
        console.log(`🔗 URL do arquivo: ${fileUrl}`);
        
        // Registrar gravação no banco de dados com URLs corretas
        await saveRecordingMetadata({
          filename,
          url: fileUrl, // URL completa para streaming
          downloadUrl: downloadUrl, // URL para download
          date: recordingProcess.segmentStartTime.toISOString(),
          duration: SEGMENT_DURATION,
          size: fileSize, // Tamanho em bytes
          cameraId: camera.id,
          userId: camera.userId || camera.integratorId || '52eeabce-d38a-498b-b29b-6da2b5d89a27',
          recordingType: 'CONTINUOUS'
        });
        
        console.log(`✅ Metadados salvos no banco: ${filename}`);
        console.log(`📁 Arquivo disponível em: ${fileUrl}`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar segmento ${filename}:`, error);
      }
    } else {
      console.log(`⚠️ Segmento ignorado (código: ${exitCode}, tamanho: ${fileSize}): ${filename}`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao processar arquivo ${filename}:`, error);
  }
  
  // Se o processo ainda estiver ativo, iniciar o próximo segmento
  if (recordingProcess.isActive) {
    startNextSegment(camera, recordingProcess);
  }
}

/**
 * Para a gravação contínua de uma câmera
 */
async function stopContinuousRecording(cameraId) {
  try {
    console.log(`Solicitando parada de gravação para câmera: ${cameraId}`);
    
    if (!activeRecordings.has(cameraId)) {
      console.log(`Nenhuma gravação ativa para câmera: ${cameraId}`);
      return { success: false, message: 'Nenhuma gravação ativa' };
    }
    
    const recordingProcess = activeRecordings.get(cameraId);
    
    // Marcar para parar após o segmento atual
    recordingProcess.stopRequested = true;
    
    // Se houver um segmento em andamento, encerrar
    if (recordingProcess.currentSegment && recordingProcess.currentSegment.process) {
      console.log(`Encerrando segmento atual para câmera: ${cameraId}`);
      recordingProcess.currentSegment.process.kill('SIGTERM');
    } else {
      // Se não houver segmento em andamento, remover da lista agora
      activeRecordings.delete(cameraId);
    }
    
    return { success: true, message: 'Solicitação de parada enviada' };
  } catch (error) {
    console.error(`Erro ao parar gravação para câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Para gravação de uma câmera (alias para compatibilidade)
 */
async function stopRecording(cameraId) {
  return stopContinuousRecording(cameraId);
}

/**
 * Lida com gravações agendadas
 */
async function handleScheduledRecordings(schedules) {
  // Por enquanto, retorna vazio pois não temos agendamentos implementados
  console.log('Verificando agendamentos de gravação...');
  return [];
}

/**
 * Captura snapshot de uma câmera
 */
async function captureSnapshot(camera) {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `snapshot_cam${camera.id}_${timestamp}.jpg`;
    const outputPath = path.join(TMP_DIR, filename);
    
    // Determinar URL de entrada (RTSP ou RTMP)
    const inputUrl = camera.rtspUrl || camera.rtmpUrl;
    
    if (!inputUrl) {
      throw new Error(`Câmera ${camera.id} não possui URL RTSP ou RTMP configurada`);
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputUrl)
        .frames(1)
        .output(outputPath)
        .on('end', async () => {
          try {
            const s3Url = await uploadToWasabi(outputPath, filename);
            await fs.unlink(outputPath);
            resolve({ success: true, url: s3Url });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  } catch (error) {
    console.error(`Erro ao capturar snapshot da câmera ${camera.id}:`, error);
    throw error;
  }
}

/**
 * Obtém estatísticas de gravação
 */
function getRecordingStats() {
  const activeStreams = Array.from(activeRecordings.keys());
  return {
    activeRecordings: activeRecordings.size,
    cameras: activeStreams
  };
}

/**
 * Lista todas as gravações ativas
 */
function listActiveRecordings() {
  return Array.from(activeRecordings.keys());
}

/**
 * Para todas as gravações ativas
 */
async function stopAllRecordings() {
  console.log('Encerrando todas as gravações ativas...');
  
  const promises = [];
  
  for (const cameraId of activeRecordings.keys()) {
    promises.push(stopContinuousRecording(cameraId));
  }
  
  await Promise.all(promises);
  console.log('Todas as gravações foram encerradas.');
}

module.exports = {
  startContinuousRecording,
  stopRecording,
  stopContinuousRecording,
  handleScheduledRecordings,
  captureSnapshot,
  getRecordingStats,
  listActiveRecordings,
  stopAllRecordings
}; 