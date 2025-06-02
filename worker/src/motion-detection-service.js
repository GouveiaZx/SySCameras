const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { uploadToWasabi } = require('./wasabi');
const { updateCameraStatus } = require('./db');

const prisma = new PrismaClient();

// Diretório para armazenar thumbnails temporários
const THUMBNAIL_DIR = path.join(__dirname, '../thumbnails');

// Criar diretório se não existir
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// Armazenar frames anteriores para comparação
const previousFrames = new Map();

// Configurações
const MOTION_CHECK_INTERVAL = 1000; // 1 segundo
const DEFAULT_THRESHOLD = 5; // 5% de diferença de pixels por padrão
const COOLDOWN_PERIOD = 60000; // 60 segundos entre alertas para evitar spam

// Registro de último alerta por câmera para controle de cooldown
const lastAlertTimes = new Map();

/**
 * Inicia monitoramento de movimento para uma câmera
 * @param {Object} camera - Objeto da câmera
 * @returns {Object} - Informações do monitoramento
 */
async function startMotionDetection(camera) {
  try {
    console.log(`Iniciando detecção de movimento para câmera ${camera.id} (${camera.name})`);
    
    // Verificar se já existe monitoramento para esta câmera
    if (previousFrames.has(camera.id)) {
      console.log(`Monitoramento já ativo para câmera ${camera.id}`);
      return { success: true, message: 'Monitoramento já ativo' };
    }
    
    // Buscar configurações de detecção de movimento
    let motionConfig = await prisma.motionDetectionConfig.findUnique({
      where: { cameraId: camera.id }
    });
    
    // Se não existir configuração, criar uma padrão
    if (!motionConfig) {
      motionConfig = await prisma.motionDetectionConfig.create({
        data: {
          cameraId: camera.id,
          enabled: true,
          sensitivity: 50,
          minMotionDuration: 3,
          notifyOnMotion: true,
          recordOnMotion: true,
          cooldownPeriod: 60
        }
      });
    }
    
    // Se detecção não estiver habilitada, não iniciar
    if (!motionConfig.enabled) {
      console.log(`Detecção de movimento desabilitada para câmera ${camera.id}`);
      return { success: false, message: 'Detecção de movimento desabilitada' };
    }
    
    // Iniciar captura periódica de frames
    const interval = setInterval(() => {
      captureAndAnalyzeFrame(camera, motionConfig);
    }, MOTION_CHECK_INTERVAL);
    
    // Armazenar referência para cancelar depois
    previousFrames.set(camera.id, {
      lastFrame: null,
      interval,
      config: motionConfig
    });
    
    return { success: true, message: 'Monitoramento de movimento iniciado' };
  } catch (error) {
    console.error(`Erro ao iniciar detecção de movimento para câmera ${camera.id}:`, error);
    return { success: false, message: 'Erro ao iniciar detecção de movimento', error: error.message };
  }
}

/**
 * Captura e analisa um frame da câmera
 * @param {Object} camera - Objeto da câmera
 * @param {Object} config - Configurações de detecção de movimento
 */
async function captureAndAnalyzeFrame(camera, config) {
  try {
    // Definir sensibilidade baseada na configuração (0-100)
    // Quanto menor o threshold, mais sensível
    const threshold = 10 - (config.sensitivity / 10); // Converte 0-100 para 10-0
    
    // Capturar frame atual
    const frameBuffer = await captureFrame(camera);
    
    // Se não conseguiu capturar frame, retornar
    if (!frameBuffer) {
      return;
    }
    
    // Processar imagem com Jimp
    const currentFrame = await Jimp.read(frameBuffer);
    
    // Redimensionar para análise mais rápida (menor resolução)
    currentFrame.resize(320, 240);
    
    // Se for o primeiro frame, apenas armazenar
    const cameraData = previousFrames.get(camera.id);
    if (!cameraData.lastFrame) {
      cameraData.lastFrame = currentFrame;
      return;
    }
    
    // Comparar com frame anterior
    const lastFrame = cameraData.lastFrame;
    const width = currentFrame.getWidth();
    const height = currentFrame.getHeight();
    
    // Contador de pixels diferentes
    let diffPixels = 0;
    const totalPixels = width * height;
    
    // Comparação pixel a pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel1 = lastFrame.getPixelColor(x, y);
        const pixel2 = currentFrame.getPixelColor(x, y);
        
        // Se pixels forem diferentes além de um limite
        if (Math.abs(Jimp.intToRGBA(pixel1).r - Jimp.intToRGBA(pixel2).r) > 30 ||
            Math.abs(Jimp.intToRGBA(pixel1).g - Jimp.intToRGBA(pixel2).g) > 30 ||
            Math.abs(Jimp.intToRGBA(pixel1).b - Jimp.intToRGBA(pixel2).b) > 30) {
          diffPixels++;
        }
      }
    }
    
    // Calcular porcentagem de diferença
    const diffPercentage = (diffPixels / totalPixels) * 100;
    
    // Atualizar frame anterior
    cameraData.lastFrame = currentFrame;
    
    // Verificar se há movimento significativo
    if (diffPercentage > threshold) {
      console.log(`Movimento detectado na câmera ${camera.id}: ${diffPercentage.toFixed(2)}% de pixels alterados`);
      
      // Verificar período de cooldown
      const now = Date.now();
      const lastAlertTime = lastAlertTimes.get(camera.id) || 0;
      
      if (now - lastAlertTime > (config.cooldownPeriod * 1000)) {
        // Registrar alerta
        await createMotionAlert(camera, currentFrame);
        
        // Atualizar timestamp do último alerta
        lastAlertTimes.set(camera.id, now);
        
        // Iniciar gravação baseada em movimento se configurado
        if (config.recordOnMotion) {
          // Aqui você pode chamar o serviço de gravação
          // Por exemplo: recordingService.startMotionBasedRecording(camera);
        }
      } else {
        console.log(`Ignorando alerta devido ao período de cooldown para câmera ${camera.id}`);
      }
    }
  } catch (error) {
    console.error(`Erro ao analisar frame para câmera ${camera.id}:`, error);
  }
}

/**
 * Captura um frame da câmera usando FFmpeg
 * @param {Object} camera - Objeto da câmera
 * @returns {Promise<Buffer>} - Buffer do frame capturado
 */
function captureFrame(camera) {
  return new Promise((resolve, reject) => {
    // Usar FFmpeg para capturar um frame do stream RTSP
    const ffmpegArgs = [
      '-i', camera.rtspUrl,
      '-rtsp_transport', 'tcp',
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-'
    ];
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    const chunks = [];
    
    ffmpegProcess.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      } else {
        console.error(`Erro ao capturar frame para câmera ${camera.id}, código: ${code}`);
        
        // Se consistentemente não conseguir capturar frames, a câmera pode estar offline
        updateCameraStatus(camera.id, 'offline').catch(err => {
          console.error(`Erro ao atualizar status da câmera ${camera.id}:`, err);
        });
        
        resolve(null);
      }
    });
    
    ffmpegProcess.stderr.on('data', () => {
      // FFmpeg envia output para stderr, ignoramos para não poluir logs
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error(`Erro no processo FFmpeg para câmera ${camera.id}:`, err);
      reject(err);
    });
  });
}

/**
 * Cria um alerta de movimento no banco de dados
 * @param {Object} camera - Objeto da câmera
 * @param {Jimp} frame - Frame com o movimento detectado
 * @returns {Promise<Object>} - Alerta criado
 */
async function createMotionAlert(camera, frame) {
  try {
    console.log(`Criando alerta de movimento para câmera ${camera.id}`);
    
    // Gerar nome único para o thumbnail
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const thumbnailFilename = `motion_${camera.id}_${timestamp}.jpg`;
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);
    
    // Salvar thumbnail
    await frame.writeAsync(thumbnailPath);
    
    // Upload do thumbnail para Wasabi (opcional)
    let thumbnailUrl = null;
    try {
      thumbnailUrl = await uploadToWasabi(camera, thumbnailPath, thumbnailFilename);
    } catch (uploadError) {
      console.error(`Erro ao fazer upload do thumbnail para câmera ${camera.id}:`, uploadError);
    }
    
    // Criar alerta no banco de dados
    const alert = await prisma.alert.create({
      data: {
        cameraId: camera.id,
        status: 'NEW',
        type: 'MOTION',
        thumbnailUrl: thumbnailUrl,
        message: 'Movimento detectado',
        date: new Date()
      }
    });
    
    console.log(`Alerta de movimento criado para câmera ${camera.id}: ${alert.id}`);
    
    // Remover arquivo temporário
    fs.unlink(thumbnailPath, (err) => {
      if (err) console.error(`Erro ao remover thumbnail temporário: ${thumbnailPath}`, err);
    });
    
    return alert;
  } catch (error) {
    console.error(`Erro ao criar alerta de movimento para câmera ${camera.id}:`, error);
    throw error;
  }
}

/**
 * Interrompe o monitoramento de movimento para uma câmera
 * @param {string} cameraId - ID da câmera
 * @returns {Object} - Resultado da operação
 */
function stopMotionDetection(cameraId) {
  try {
    console.log(`Parando detecção de movimento para câmera ${cameraId}`);
    
    if (!previousFrames.has(cameraId)) {
      return { success: false, message: 'Câmera não está sendo monitorada' };
    }
    
    // Parar o intervalo
    const cameraData = previousFrames.get(cameraId);
    clearInterval(cameraData.interval);
    
    // Remover da lista
    previousFrames.delete(cameraId);
    
    return { success: true, message: 'Monitoramento de movimento interrompido' };
  } catch (error) {
    console.error(`Erro ao parar detecção de movimento para câmera ${cameraId}:`, error);
    return { success: false, message: 'Erro ao parar detecção de movimento', error: error.message };
  }
}

/**
 * Lista todas as câmeras com detecção de movimento ativa
 * @returns {Array<string>} - Lista de IDs de câmeras
 */
function listActiveMotionDetection() {
  return Array.from(previousFrames.keys());
}

/**
 * Para toda a detecção de movimento
 */
function stopAllMotionDetection() {
  console.log('Parando toda detecção de movimento');
  
  for (const cameraId of previousFrames.keys()) {
    stopMotionDetection(cameraId);
  }
}

module.exports = {
  startMotionDetection,
  stopMotionDetection,
  listActiveMotionDetection,
  stopAllMotionDetection
}; 