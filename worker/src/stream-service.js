/**
 * Serviço para gerenciar streaming de câmeras com FFmpeg
 * Converte RTSP para RTMP (ingest no servidor SRS)
 */

const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Armazenar processos FFmpeg ativos
const activeStreams = new Map();

/**
 * Inicia um processo FFmpeg para converter RTSP para RTMP
 * @param {string} streamName Nome único do stream
 * @param {string} rtspUrl URL RTSP da câmera
 * @param {string} srsUrl URL base do servidor SRS
 * @returns {Promise<Object>} Resultado da operação
 */
async function startStream(streamName, rtspUrl, srsUrl) {
  try {
    // Verificar se já existe um stream com este nome
    if (activeStreams.has(streamName)) {
      console.log(`Stream já está em execução: ${streamName}`);
      return { success: true, message: 'Stream já está em execução' };
    }

    console.log(`Iniciando stream: ${streamName} de ${rtspUrl}`);

    // Construir URL RTMP para o servidor SRS
    const rtmpUrl = `rtmp://${srsUrl}/live/${streamName}`;

    // Montar comando FFmpeg para converter RTSP para RTMP
    const ffmpegArgs = [
      '-i', rtspUrl,             // Input RTSP
      '-c:v', 'copy',            // Copiar codec de vídeo (sem recodificar)
      '-c:a', 'aac',             // Converter áudio para AAC se presente
      '-f', 'flv',               // Formato de saída FLV
      '-rtsp_transport', 'tcp',  // Usar TCP para RTSP (mais confiável)
      '-fflags', 'nobuffer',     // Minimizar buffer para reduzir latência
      '-flags', 'low_delay',     // Reduzir latência
      rtmpUrl                    // Output RTMP
    ];

    // Iniciar processo FFmpeg
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    // Salvar referência do processo
    activeStreams.set(streamName, ffmpegProcess);

    // Logs do processo
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[Stream ${streamName}] STDOUT: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[Stream ${streamName}] STDERR: ${data}`);
    });

    // Monitorar encerramento do processo
    ffmpegProcess.on('close', async (code) => {
      console.log(`[Stream ${streamName}] Processo encerrado com código: ${code}`);
      
      // Remover da lista de streams ativos
      activeStreams.delete(streamName);

      // Se não foi um encerramento normal, atualizar status no banco
      if (code !== 0) {
        try {
          // Buscar registro do stream pelo nome
          const stream = await prisma.cameraStream.findUnique({
            where: { streamName },
            include: { camera: true }
          });

          if (stream) {
            // Atualizar status do stream
            await prisma.cameraStream.update({
              where: { id: stream.id },
              data: { 
                status: 'ERROR',
                errorMessage: `FFmpeg encerrado com código: ${code}`
              }
            });

            // Atualizar status da câmera
            await prisma.camera.update({
              where: { id: stream.cameraId },
              data: { 
                streamStatus: 'INACTIVE',
                hlsUrl: null
              }
            });
          }
        } catch (error) {
          console.error(`Erro ao atualizar status do stream após falha: ${error}`);
        }
      }
    });

    // Esperar um pouco para verificar se o processo iniciou corretamente
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar se o processo ainda está em execução
    if (ffmpegProcess.exitCode !== null) {
      throw new Error(`FFmpeg falhou ao iniciar, código de saída: ${ffmpegProcess.exitCode}`);
    }

    // Atualizar status do stream no banco de dados
    const stream = await prisma.cameraStream.findUnique({
      where: { streamName }
    });

    if (stream) {
      await prisma.cameraStream.update({
        where: { id: stream.id },
        data: { status: 'ACTIVE' }
      });
    }

    return { success: true, message: 'Stream iniciado com sucesso' };
  } catch (error) {
    console.error(`Erro ao iniciar stream ${streamName}:`, error);
    
    // Limpar qualquer processo que possa ter sido criado
    if (activeStreams.has(streamName)) {
      const process = activeStreams.get(streamName);
      process.kill('SIGKILL');
      activeStreams.delete(streamName);
    }

    // Atualizar status no banco
    try {
      const stream = await prisma.cameraStream.findUnique({
        where: { streamName }
      });

      if (stream) {
        await prisma.cameraStream.update({
          where: { id: stream.id },
          data: { 
            status: 'ERROR',
            errorMessage: error.message || 'Erro desconhecido'
          }
        });

        await prisma.camera.update({
          where: { id: stream.cameraId },
          data: { streamStatus: 'INACTIVE' }
        });
      }
    } catch (dbError) {
      console.error('Erro ao atualizar status após falha:', dbError);
    }

    throw error;
  }
}

/**
 * Encerra um processo de streaming FFmpeg
 * @param {string} streamName Nome do stream a ser encerrado
 * @returns {Promise<Object>} Resultado da operação
 */
async function stopStream(streamName) {
  try {
    console.log(`Encerrando stream: ${streamName}`);

    if (!activeStreams.has(streamName)) {
      console.log(`Stream não encontrado: ${streamName}`);
      return { success: false, message: 'Stream não está em execução' };
    }

    // Obter e encerrar o processo FFmpeg
    const process = activeStreams.get(streamName);
    process.kill('SIGTERM'); // Encerramento gracioso

    // Esperar um pouco pelo encerramento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Se o processo ainda estiver em execução, forçar o encerramento
    if (process.exitCode === null) {
      process.kill('SIGKILL');
    }

    // Remover da lista de streams ativos
    activeStreams.delete(streamName);

    return { success: true, message: 'Stream encerrado com sucesso' };
  } catch (error) {
    console.error(`Erro ao encerrar stream ${streamName}:`, error);
    throw error;
  }
}

/**
 * Lista todos os streams ativos
 * @returns {Array} Lista de streams ativos
 */
function listActiveStreams() {
  return Array.from(activeStreams.keys());
}

/**
 * Encerra todos os streams ativos (útil para shutdown do serviço)
 */
async function stopAllStreams() {
  console.log('Encerrando todos os streams ativos...');
  
  const promises = [];
  
  for (const streamName of activeStreams.keys()) {
    promises.push(stopStream(streamName));
  }
  
  await Promise.all(promises);
  console.log('Todos os streams foram encerrados.');
}

// Exportar funções
module.exports = {
  startStream,
  stopStream,
  listActiveStreams,
  stopAllStreams
}; 