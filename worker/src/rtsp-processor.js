const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { uploadToWasabi } = require('./wasabi');
const { saveRecordingMetadata } = require('./db');

// Diretório temporário para gravar os arquivos MP4
const TMP_DIR = path.join(__dirname, '../tmp');

// Certifica-se que o diretório temporário existe
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Processa uma stream RTSP, grava em MP4 e faz upload para Wasabi
 * @param {Object} camera - Objeto com dados da câmera (id, name, rtspUrl, clientId, integratorId)
 */
async function processRTSPStream(camera) {
  console.log(`Iniciando processamento para câmera: ${camera.name} (${camera.id})`);
  
  // Gera nome do arquivo baseado na data e id da câmera
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `camera_${camera.id}_${timestamp}.mp4`;
  const outputPath = path.join(TMP_DIR, filename);
  
  // Define duração da gravação (60 minutos por padrão)
  const duration = process.env.RECORDING_DURATION_MINUTES || 60;
  
  return new Promise((resolve, reject) => {
    console.log(`Iniciando gravação de ${camera.rtspUrl} para ${outputPath}`);
    
    ffmpeg(camera.rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-use_wallclock_as_timestamps 1',
        '-thread_queue_size 512'
      ])
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-t ' + (duration * 60) // Duração em segundos
      ])
      .output(outputPath)
      .on('start', () => {
        console.log(`Gravação iniciada para câmera ${camera.id}`);
      })
      .on('progress', (progress) => {
        console.log(`Progresso para câmera ${camera.id}: ${progress.percent}% concluído`);
      })
      .on('end', async () => {
        console.log(`Gravação concluída para câmera ${camera.id}, iniciando upload para Wasabi`);
        
        try {
          // Obtém estatísticas do arquivo
          const stats = fs.statSync(outputPath);
          const fileSizeInBytes = stats.size;
          
          // Faz upload para Wasabi
          const fileUrl = await uploadToWasabi(outputPath, filename);
          
          // Salva os metadados da gravação no banco
          await saveRecordingMetadata({
            filename,
            url: fileUrl,
            date: new Date(),
            duration: duration * 60, // Duração em segundos
            size: fileSizeInBytes,
            cameraId: camera.id,
            userId: camera.userId
          });
          
          console.log(`Upload concluído para câmera ${camera.id}: ${fileUrl}`);
          
          // Remove arquivo temporário
          fs.unlinkSync(outputPath);
          console.log(`Arquivo temporário removido: ${outputPath}`);
          
          resolve();
        } catch (error) {
          console.error(`Erro após gravação para câmera ${camera.id}:`, error);
          reject(error);
        }
      })
      .on('error', (err) => {
        console.error(`Erro na gravação para câmera ${camera.id}:`, err);
        reject(err);
      })
      .run();
  });
}

module.exports = {
  processRTSPStream
}; 