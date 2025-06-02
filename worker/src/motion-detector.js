const cv = require('opencv4nodejs');
const fs = require('fs');
const path = require('path');
const { getMotionDetectionConfig } = require('./db');
const { startContinuousRecording } = require('./recording-service');

// Diretório para armazenamento de frames de debug (se habilitado)
const DEBUG_DIR = path.join(__dirname, '../debug');
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// Mapa para controlar as streams de detecção ativas
const activeDetectors = new Map();

// Mapa para evitar múltiplas gravações em rápida sucessão (cooldown)
const motionCooldowns = new Map();

/**
 * Inicia a detecção de movimento para uma câmera
 * @param {Object} camera - Dados da câmera
 */
async function startMotionDetection(camera) {
  // Verifica se já existe detecção ativa para esta câmera
  if (activeDetectors.has(camera.id)) {
    console.log(`Detecção de movimento já ativa para câmera ${camera.id}`);
    return;
  }
  
  try {
    // Busca configuração de detecção de movimento
    const config = await getMotionDetectionConfig(camera.id);
    
    // Se não houver configuração ou estiver desabilitada, não faz nada
    if (!config || !config.enabled) {
      console.log(`Detecção de movimento não habilitada para câmera ${camera.id}`);
      return;
    }
    
    console.log(`Iniciando detecção de movimento para câmera ${camera.id} (sensibilidade: ${config.sensitivity}%)`);
    
    // Abre o stream RTSP
    const cap = new cv.VideoCapture(camera.rtspUrl);
    
    // Configurações
    const sensitivity = config.sensitivity / 100; // Normaliza para 0-1
    const minMotionDuration = config.minMotionDuration || 3; // Em segundos
    const cooldownPeriod = config.cooldownPeriod || 60; // Em segundos
    
    // Define áreas de detecção (se existirem)
    let detectionMask = null;
    if (config.detectionAreas) {
      try {
        const areas = JSON.parse(config.detectionAreas);
        if (areas && areas.length > 0) {
          // Implementar criação de máscara baseada nas áreas definidas
          // Para simplificar, não implementamos aqui, mas você pode adicionar isso
        }
      } catch (e) {
        console.error(`Erro ao processar áreas de detecção para câmera ${camera.id}:`, e);
      }
    }
    
    // Estado do detector
    let isFirstFrame = true;
    let previousFrame = null;
    let motionStartedAt = null;
    let isMotionDetected = false;
    let consecutiveMotionFrames = 0;
    
    // Função de processamento de frame
    const processFrame = async () => {
      try {
        // Se o detector foi parado, não processamos mais frames
        if (!activeDetectors.has(camera.id)) {
          return;
        }
        
        // Lê o próximo frame
        const frame = await cap.readAsync();
        
        // Se não houver frame, pode ser um erro de conexão
        if (!frame || frame.empty) {
          console.error(`Sem frames para câmera ${camera.id}, possível problema de conexão`);
          // Tentar reconnectar em 5 segundos
          setTimeout(() => {
            if (activeDetectors.has(camera.id)) {
              processFrame();
            }
          }, 5000);
          return;
        }
        
        // No primeiro frame, apenas armazenamos e continuamos
        if (isFirstFrame) {
          isFirstFrame = false;
          previousFrame = frame.copy();
          // Agenda o próximo frame
          setImmediate(processFrame);
          return;
        }
        
        // Converte para escala de cinza e aplica blur para reduzir ruído
        const gray = frame.cvtColor(cv.COLOR_BGR2GRAY);
        const blurred = gray.gaussianBlur(new cv.Size(21, 21), 0);
        
        // Primeiro frame: inicializa e continua
        if (!previousFrame) {
          previousFrame = blurred.copy();
          setImmediate(processFrame);
          return;
        }
        
        // Calcula diferença absoluta entre frames
        const frameDelta = previousFrame.absdiff(blurred);
        
        // Aplica threshold para identificar diferenças significativas
        const threshold = frameDelta.threshold(
          25, // Valor de threshold
          255, // Valor máximo
          cv.THRESH_BINARY // Tipo de threshold
        );
        
        // Dilata a imagem para preencher buracos
        let dilated = threshold.dilate(
          cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)),
          new cv.Point(-1, -1),
          2
        );
        
        // Aplica máscara de detecção se existir
        if (detectionMask) {
          dilated = dilated.bitwiseAnd(detectionMask);
        }
        
        // Encontra contornos
        const contours = dilated.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Analisa os contornos para determinar movimento
        let motionDetected = false;
        let totalMotionArea = 0;
        const totalArea = dilated.rows * dilated.cols;
        
        for (const contour of contours) {
          const area = contour.area;
          // Ignora contornos muito pequenos (ruído)
          if (area < 500) continue;
          
          totalMotionArea += area;
        }
        
        // Calcula a porcentagem de movimento na imagem
        const motionPercentage = totalMotionArea / totalArea;
        
        // Determina se há movimento significativo
        motionDetected = motionPercentage > (0.01 * sensitivity);
        
        // Armazena frame atual como próximo frame de referência
        previousFrame = blurred.copy();
        
        // Se detectou movimento
        if (motionDetected) {
          consecutiveMotionFrames++;
          
          // Se é o início do movimento
          if (!isMotionDetected) {
            motionStartedAt = new Date();
            isMotionDetected = true;
            console.log(`Movimento inicial detectado na câmera ${camera.id}`);
          }
          
          // Verifica se já atingiu a duração mínima para considerar movimento real
          const motionDuration = (new Date() - motionStartedAt) / 1000;
          
          if (motionDuration >= minMotionDuration && consecutiveMotionFrames >= 5) {
            // Verifica cooldown para evitar múltiplas gravações
            const lastTrigger = motionCooldowns.get(camera.id);
            const now = Date.now();
            
            if (!lastTrigger || (now - lastTrigger) > (cooldownPeriod * 1000)) {
              console.log(`Movimento confirmado na câmera ${camera.id} (${motionPercentage.toFixed(4)}), iniciando gravação`);
              
              // Registra horário do trigger para cooldown
              motionCooldowns.set(camera.id, now);
              
              // Inicia gravação baseada em movimento
              if (config.recordOnMotion) {
                try {
                  await startContinuousRecording(camera, {
                    recordingType: 'MOTION',
                    duration: Math.max(5, config.postRecordingBuffer / 60) // Mínimo 5 minutos
                  });
                  
                  console.log(`Gravação por movimento iniciada para câmera ${camera.id}`);
                } catch (recError) {
                  console.error(`Erro ao iniciar gravação por movimento para câmera ${camera.id}:`, recError);
                }
              }
              
              // Se configurado para notificar
              if (config.notifyOnMotion) {
                // Aqui você implementaria a lógica de notificação
                console.log(`Notificação de movimento para câmera ${camera.id}`);
              }
              
              // Salva frame de debug se estiver em modo debug
              if (process.env.DEBUG_MOTION === 'true') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const debugPath = path.join(DEBUG_DIR, `motion_${camera.id}_${timestamp}.jpg`);
                cv.imwrite(debugPath, frame);
                console.log(`Frame de debug salvo: ${debugPath}`);
              }
            } else {
              console.log(`Movimento detectado na câmera ${camera.id}, mas ainda em cooldown (${Math.floor((now - lastTrigger) / 1000)}/${cooldownPeriod}s)`);
            }
          }
        } else {
          // Sem movimento, reseta contadores
          if (isMotionDetected) {
            console.log(`Movimento parou na câmera ${camera.id} após ${((new Date() - motionStartedAt) / 1000).toFixed(1)}s`);
            isMotionDetected = false;
          }
          consecutiveMotionFrames = 0;
        }
        
        // Agenda o próximo frame (com atraso para reduzir CPU)
        setTimeout(processFrame, 200);
        
      } catch (error) {
        console.error(`Erro ao processar frame para detecção de movimento na câmera ${camera.id}:`, error);
        
        // Tenta recuperar em 5 segundos
        setTimeout(() => {
          if (activeDetectors.has(camera.id)) {
            processFrame();
          }
        }, 5000);
      }
    };
    
    // Armazena estado no mapa de detectores ativos
    activeDetectors.set(camera.id, {
      cap,
      config
    });
    
    // Inicia o processamento
    processFrame();
    
  } catch (error) {
    console.error(`Erro ao iniciar detecção de movimento para câmera ${camera.id}:`, error);
    // Remove do mapa de detectores ativos em caso de erro
    activeDetectors.delete(camera.id);
    throw error;
  }
}

/**
 * Para a detecção de movimento para uma câmera
 * @param {string} cameraId - ID da câmera
 */
function stopMotionDetection(cameraId) {
  const detector = activeDetectors.get(cameraId);
  if (!detector) {
    console.log(`Detecção de movimento não ativa para câmera ${cameraId}`);
    return;
  }
  
  console.log(`Parando detecção de movimento para câmera ${cameraId}`);
  
  try {
    // Fecha a captura
    if (detector.cap) {
      detector.cap.release();
    }
    
    // Remove do mapa de detectores ativos
    activeDetectors.delete(cameraId);
    
  } catch (error) {
    console.error(`Erro ao parar detecção de movimento para câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Verifica e inicia detecção de movimento para todas as câmeras com configuração habilitada
 */
async function setupMotionDetectionForAllCameras(cameras) {
  try {
    if (!cameras || cameras.length === 0) {
      console.log('Nenhuma câmera disponível para detecção de movimento');
      return;
    }
    
    console.log(`Verificando detecção de movimento para ${cameras.length} câmeras`);
    
    for (const camera of cameras) {
      try {
        if (camera.status !== 'online') {
          console.log(`Pulando detecção de movimento para câmera offline ${camera.id}`);
          continue;
        }
        
        const config = await getMotionDetectionConfig(camera.id);
        
        if (config && config.enabled) {
          await startMotionDetection(camera);
        } else {
          console.log(`Detecção de movimento não habilitada para câmera ${camera.id}`);
        }
      } catch (error) {
        console.error(`Erro ao configurar detecção de movimento para câmera ${camera.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Erro ao configurar detecção de movimento para câmeras:', error);
  }
}

module.exports = {
  startMotionDetection,
  stopMotionDetection,
  setupMotionDetectionForAllCameras
}; 