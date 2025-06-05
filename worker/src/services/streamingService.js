const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configurar caminho do FFmpeg usando ffmpeg-static
const ffmpegStatic = require('ffmpeg-static');
const ffmpegPath = ffmpegStatic;

class StreamingService {
  constructor() {
    this.activeStreams = new Map(); // cameraId -> process
    this.streamDirectory = path.join(__dirname, '../../streams');
    this.ensureStreamDirectory();
  }

  ensureStreamDirectory() {
    if (!fs.existsSync(this.streamDirectory)) {
      fs.mkdirSync(this.streamDirectory, { recursive: true });
      console.log('📁 Diretório de streams criado:', this.streamDirectory);
    }
  }

  /**
   * Inicia streaming HLS para uma câmera RTSP/RTMP
   * @param {string} cameraId - ID da câmera
   * @param {string} inputUrl - URL RTSP ou RTMP da câmera
   * @param {Object} options - Opções de streaming
   * @returns {Promise} Promise com resultado da operação
   */
  async startHLSStream(cameraId, inputUrl, options = {}) {
    try {
      console.log(`🎥 Iniciando stream HLS para câmera ${cameraId}`);
      console.log(`📡 URL de entrada: ${inputUrl}`);
      
      // Verificar se FFmpeg está disponível
      if (!fs.existsSync(ffmpegPath)) {
        throw new Error('FFmpeg não encontrado. Instale o FFmpeg para usar streams de câmeras.');
      }
      
      console.log(`🔧 Usando FFmpeg: ${ffmpegPath}`);
      console.log(`🎥 Conectando na câmera: ${inputUrl}`);
      
      // Detectar protocolo
      const isRTMP = inputUrl.toLowerCase().startsWith('rtmp://');
      const isRTSP = inputUrl.toLowerCase().startsWith('rtsp://');
      
      if (!isRTMP && !isRTSP) {
        throw new Error('URL deve começar com rtsp:// ou rtmp://');
      }
      
      console.log(`🔍 Protocolo detectado: ${isRTMP ? 'RTMP' : 'RTSP'}`);
      
      // Obter configurações de qualidade
      const quality = options.quality || 'medium';
      const qualityConfig = this.getQualityConfig(quality);
      console.log(`🎯 Configurações de qualidade (${quality}):`, qualityConfig);
      
      // Verificar se já existe stream ativo
      if (this.activeStreams.has(cameraId)) {
        console.log(`⚠️ Stream já ativo para câmera ${cameraId}, parando o anterior...`);
        this.stopHLSStream(cameraId);
        // Aguardar um pouco para o processo ser morto
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Criar diretório específico da câmera
      const cameraStreamDir = path.join(this.streamDirectory, cameraId);
      if (!fs.existsSync(cameraStreamDir)) {
        fs.mkdirSync(cameraStreamDir, { recursive: true });
      }

      // Configurações do FFmpeg para HLS
      const outputPath = path.join(cameraStreamDir, 'stream.m3u8');
      const segmentPath = path.join(cameraStreamDir, 'segment%03d.ts');

      // Configurar argumentos baseados no protocolo
      let ffmpegArgs;
      
      if (isRTMP) {
        console.log('🔴 Configurando FFmpeg para RTMP...');
        ffmpegArgs = [
          '-i', inputUrl,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-maxrate', qualityConfig.maxrate,
          '-bufsize', qualityConfig.bufsize,
          '-g', '30',
          '-r', qualityConfig.framerate,
          '-s', qualityConfig.resolution,
          '-threads', '2',
          '-an', // Sem áudio para simplificar
          '-f', 'hls',
          '-hls_time', '2',
          '-hls_list_size', '3',
          '-hls_flags', 'delete_segments',
          '-hls_segment_filename', segmentPath,
          '-y',
          outputPath
        ];
      } else if (isRTSP) {
        console.log('🔵 Configurando FFmpeg para RTSP...');
        ffmpegArgs = [
          '-rtsp_transport', 'tcp', // Apenas para RTSP
          '-timeout', '10000000',
          '-i', inputUrl,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-maxrate', qualityConfig.maxrate,
          '-bufsize', qualityConfig.bufsize,
          '-g', '30',
          '-r', qualityConfig.framerate,
          '-s', qualityConfig.resolution,
          '-threads', '2',
          '-an', // Sem áudio para simplificar
          '-f', 'hls',
          '-hls_time', '2',
          '-hls_list_size', '3',
          '-hls_flags', 'delete_segments',
          '-hls_segment_filename', segmentPath,
          '-y',
          outputPath
        ];
      }

      console.log('🚀 Executando FFmpeg:', ffmpegPath, ffmpegArgs.join(' '));

      // Iniciar processo FFmpeg
      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      // Armazenar informações do stream
      this.activeStreams.set(cameraId, {
        process: ffmpegProcess,
        startTime: new Date(),
        inputUrl,
        outputPath,
        status: 'starting',
        lastHealthCheck: new Date(),
        restartCount: 0,
        protocol: isRTMP ? 'RTMP' : 'RTSP',
        quality: quality,
        qualityConfig: qualityConfig
      });

      // Handlers do processo
      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`📺 FFmpeg stdout [${cameraId}]:`, data.toString());
      });

      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`📺 FFmpeg stderr [${cameraId}]:`, output);
        
        // Detectar quando o stream está funcionando - melhorar as palavras-chave
        if (output.includes('Opening') || 
            output.includes('Stream mapping') || 
            output.includes('muxer') ||
            output.includes('hls_init') ||
            output.includes('segment') ||
            output.includes('Output #0')) {
          const streamInfo = this.activeStreams.get(cameraId);
          if (streamInfo) {
            streamInfo.status = 'running';
            this.activeStreams.set(cameraId, streamInfo);
            console.log(`🟢 Stream status atualizado para 'running' [${cameraId}]`);
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        console.log(`🏁 FFmpeg process encerrado [${cameraId}] com código:`, code);
        if (code !== 0) {
          console.error(`❌ FFmpeg encerrou com erro [${cameraId}] código: ${code}`);
        }
        this.activeStreams.delete(cameraId);
        
        // Limpar arquivos do stream
        this.cleanupStreamFiles(cameraId);
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`❌ Erro no FFmpeg [${cameraId}]:`, error);
        this.activeStreams.delete(cameraId);
      });

      // Log do PID do processo
      console.log(`🔧 FFmpeg PID [${cameraId}]: ${ffmpegProcess.pid}`);

      // Aguardar que o arquivo m3u8 seja criado (até 10 segundos)
      let attempts = 0;
      const maxAttempts = 20; // 20 tentativas de 0.5s = 10 segundos
      
      console.log(`⏳ Aguardando criação do arquivo m3u8: ${outputPath}`);
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        console.log(`🔍 Tentativa ${attempts}/${maxAttempts} - Verificando arquivo: ${outputPath}`);
        
        if (fs.existsSync(outputPath)) {
          console.log(`✅ Arquivo m3u8 criado: ${outputPath}`);
          break;
        }
        
        // Verificar se o processo ainda está rodando
        if (!this.activeStreams.has(cameraId)) {
          console.log(`❌ Stream removido da lista ativa durante aguardo`);
          throw new Error('Processo FFmpeg encerrou antes de criar o arquivo HLS');
        }
        
        // Log do status do processo
        const streamInfo = this.activeStreams.get(cameraId);
        if (streamInfo && streamInfo.process) {
          console.log(`📊 Status do processo FFmpeg: PID ${streamInfo.process.pid}, killed: ${streamInfo.process.killed}`);
        }
      }

      if (!fs.existsSync(outputPath)) {
        console.log(`❌ Timeout: arquivo m3u8 não foi criado em ${maxAttempts * 0.5} segundos`);
        console.log(`🔄 Tentando solução alternativa com snapshots...`);
        
        // Fallback: criar stream usando snapshots
        return await this.createSnapshotBasedStream(cameraId, inputUrl, cameraStreamDir);
      }

      const streamInfo = this.activeStreams.get(cameraId);
      if (streamInfo) {
        streamInfo.status = 'running';
        this.activeStreams.set(cameraId, streamInfo);
      }

      console.log(`✅ Stream HLS iniciado com sucesso para câmera ${cameraId}`);

      return {
        success: true,
        message: 'Stream HLS iniciado com sucesso',
        hlsUrl: this.getHLSUrl(cameraId),
        streamInfo: {
          cameraId,
          status: 'running',
          startTime: new Date()
        }
      };

    } catch (error) {
      console.error(`❌ Erro ao iniciar stream HLS [${cameraId}]:`, error);
      
      // Fallback final: tentar modo simulado se tudo falhar
      console.log(`🔄 Tentando modo simulado como fallback final...`);
      try {
        return await this.createSimulatedStream(cameraId, inputUrl, options);
      } catch (fallbackError) {
        console.error(`❌ Erro no fallback simulado:`, fallbackError);
        return {
          success: false,
          message: 'Falha ao iniciar stream HLS',
          error: error.message
        };
      }
    }
  }

  /**
   * Cria um stream HLS baseado em snapshots como fallback
   * @param {string} cameraId - ID da câmera
   * @param {string} inputUrl - URL RTSP ou RTMP da câmera
   * @param {string} outputDir - Diretório de saída
   * @returns {Promise} Promise com resultado da operação
   */
  async createSnapshotBasedStream(cameraId, inputUrl, outputDir) {
    try {
      console.log(`📸 Criando stream baseado em snapshots para câmera ${cameraId}`);
      
      // Criar arquivo m3u8 inicial
      const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT
`;
      
      const outputPath = path.join(outputDir, 'stream.m3u8');
      fs.writeFileSync(outputPath, m3u8Content);
      
      // Configurar captura de snapshots em intervalos
      let sequenceNumber = 0;
      const snapshotInterval = setInterval(async () => {
        try {
          const segmentName = `segment${sequenceNumber.toString().padStart(3, '0')}.jpg`;
          const segmentPath = path.join(outputDir, segmentName);
          
          // Capturar snapshot usando FFmpeg
          const snapshotArgs = [
            '-i', inputUrl,
            '-rtsp_transport', 'tcp',
            '-frames:v', '1',
            '-f', 'image2',
            '-y',
            segmentPath
          ];
          
          const snapshotProcess = spawn(ffmpegPath, snapshotArgs);
          
          snapshotProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(segmentPath)) {
              // Atualizar arquivo m3u8
              const updatedM3u8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:${Math.max(0, sequenceNumber - 2)}
#EXT-X-PLAYLIST-TYPE:EVENT
${sequenceNumber >= 2 ? `#EXTINF:3.0,\nsegment${(sequenceNumber-2).toString().padStart(3, '0')}.jpg\n` : ''}
${sequenceNumber >= 1 ? `#EXTINF:3.0,\nsegment${(sequenceNumber-1).toString().padStart(3, '0')}.jpg\n` : ''}
#EXTINF:3.0,
${segmentName}
`;
              fs.writeFileSync(outputPath, updatedM3u8);
              
              // Remover segmentos antigos (manter apenas 3)
              if (sequenceNumber >= 3) {
                const oldSegment = path.join(outputDir, `segment${(sequenceNumber-3).toString().padStart(3, '0')}.jpg`);
                if (fs.existsSync(oldSegment)) {
                  fs.unlinkSync(oldSegment);
                }
              }
            }
          });
          
          sequenceNumber++;
        } catch (error) {
          console.error(`❌ Erro ao capturar snapshot [${cameraId}]:`, error);
        }
      }, 3000); // Capturar a cada 3 segundos
      
      // Armazenar informações do stream alternativo
      this.activeStreams.set(cameraId, {
        type: 'snapshot',
        interval: snapshotInterval,
        startTime: new Date(),
        inputUrl,
        outputPath,
        status: 'running'
      });
      
      console.log(`✅ Stream baseado em snapshots iniciado para câmera ${cameraId}`);
      
      return {
        success: true,
        message: 'Stream HLS iniciado com snapshots (modo compatibilidade)',
        hlsUrl: this.getHLSUrl(cameraId),
        streamInfo: {
          cameraId,
          status: 'running',
          startTime: new Date(),
          type: 'snapshot'
        }
      };
      
    } catch (error) {
      console.error(`❌ Erro ao criar stream baseado em snapshots [${cameraId}]:`, error);
      throw error;
    }
  }

  /**
   * Para o streaming HLS de uma câmera
   * @param {string} cameraId - ID da câmera
   * @returns {Object} Resultado da operação
   */
  stopHLSStream(cameraId) {
    try {
      console.log(`🛑 Parando stream HLS para câmera ${cameraId}`);
      
      const streamInfo = this.activeStreams.get(cameraId);
      if (!streamInfo) {
        return {
          success: false,
          message: 'Stream não encontrado ou já parado'
        };
      }

      // Verificar tipo de stream e parar adequadamente
      if (streamInfo.type === 'snapshot') {
        // Parar interval de snapshots
        if (streamInfo.interval) {
          clearInterval(streamInfo.interval);
        }
      } else {
        // Matar processo FFmpeg
        if (streamInfo.process && streamInfo.process.pid) {
          console.log(`🔧 Matando processo FFmpeg PID: ${streamInfo.process.pid}`);
          
          try {
            // No Windows, usar taskkill para força total
            if (process.platform === 'win32') {
              const { execSync } = require('child_process');
              execSync(`taskkill /F /PID ${streamInfo.process.pid}`, { stdio: 'ignore' });
              console.log(`✅ Processo FFmpeg ${streamInfo.process.pid} morto via taskkill`);
            } else {
              // Linux/Mac - usar SIGKILL em vez de SIGTERM
              streamInfo.process.kill('SIGKILL');
              console.log(`✅ Processo FFmpeg ${streamInfo.process.pid} morto via SIGKILL`);
            }
          } catch (killError) {
            console.warn(`⚠️ Erro ao matar processo ${streamInfo.process.pid}:`, killError.message);
            // Continuar mesmo se der erro
          }
        }
      }
      
      // Remover da lista de streams ativos
      this.activeStreams.delete(cameraId);
      
      // Limpar arquivos
      this.cleanupStreamFiles(cameraId);

      console.log(`✅ Stream HLS parado para câmera ${cameraId}`);
      
      return {
        success: true,
        message: 'Stream HLS parado com sucesso'
      };

    } catch (error) {
      console.error(`❌ Erro ao parar stream HLS [${cameraId}]:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Falha ao parar stream HLS'
      };
    }
  }

  /**
   * Obter status de um stream
   * @param {string} cameraId - ID da câmera
   * @returns {Object} Status do stream
   */
  getStreamStatus(cameraId) {
    const streamInfo = this.activeStreams.get(cameraId);
    
    if (!streamInfo) {
      return {
        active: false,
        status: 'stopped'
      };
    }

    return {
      active: true,
      status: streamInfo.status,
      startTime: streamInfo.startTime,
      rtspUrl: streamInfo.inputUrl,
      hlsUrl: this.getHLSUrl(cameraId),
      uptime: Date.now() - streamInfo.startTime.getTime()
    };
  }

  /**
   * Listar todos os streams ativos
   * @returns {Array} Lista de streams ativos
   */
  getActiveStreams() {
    const streams = [];
    
    for (const [cameraId, streamInfo] of this.activeStreams) {
      streams.push({
        cameraId,
        status: streamInfo.status,
        startTime: streamInfo.startTime,
        hlsUrl: this.getHLSUrl(cameraId),
        uptime: Date.now() - streamInfo.startTime.getTime()
      });
    }

    return streams;
  }

  /**
   * Gerar URL HLS para uma câmera
   * @param {string} cameraId - ID da câmera
   * @returns {string} URL HLS
   */
  getHLSUrl(cameraId) {
    // Usar URL relativa que será resolvida através do nginx proxy
    return `/hls/${cameraId}/stream.m3u8`;
  }

  /**
   * Limpar arquivos de stream de uma câmera
   * @param {string} cameraId - ID da câmera
   */
  cleanupStreamFiles(cameraId) {
    try {
      const cameraStreamDir = path.join(this.streamDirectory, cameraId);
      
      if (fs.existsSync(cameraStreamDir)) {
        const files = fs.readdirSync(cameraStreamDir);
        
        for (const file of files) {
          const filePath = path.join(cameraStreamDir, file);
          fs.unlinkSync(filePath);
        }
        
        fs.rmdirSync(cameraStreamDir);
        console.log(`🗑️ Arquivos de stream limpos para câmera ${cameraId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar arquivos de stream [${cameraId}]:`, error);
    }
  }

  /**
   * Parar todos os streams ativos
   */
  stopAllStreams() {
    console.log('🛑 Parando todos os streams ativos...');
    
    for (const cameraId of this.activeStreams.keys()) {
      this.stopHLSStream(cameraId);
    }
    
    // Matar todos os processos FFmpeg órfãos (Windows)
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        console.log('🔧 Matando todos os processos FFmpeg órfãos...');
        execSync('taskkill /F /IM ffmpeg.exe', { stdio: 'ignore' });
        console.log('✅ Processos FFmpeg órfãos limpos');
      } catch (error) {
        console.log('ℹ️ Nenhum processo FFmpeg órfão encontrado');
      }
    } else {
      // Linux/Mac
      try {
        const { execSync } = require('child_process');
        execSync('pkill -f ffmpeg', { stdio: 'ignore' });
        console.log('✅ Processos FFmpeg órfãos limpos');
      } catch (error) {
        console.log('ℹ️ Nenhum processo FFmpeg órfão encontrado');
      }
    }
    
    console.log('✅ Todos os streams foram parados');
  }

  /**
   * Reinicia um stream problemático
   * @param {string} cameraId - ID da câmera
   * @param {string} inputUrl - URL RTSP ou RTMP da câmera
   */
  async restartStream(cameraId, inputUrl) {
    try {
      console.log(`🔄 Reiniciando stream para câmera ${cameraId}`);
      
      const streamInfo = this.activeStreams.get(cameraId);
      if (streamInfo) {
        streamInfo.restartCount = (streamInfo.restartCount || 0) + 1;
        // Usar a URL original se não foi fornecida uma nova
        inputUrl = inputUrl || streamInfo.inputUrl;
      }

      // Parar o stream atual
      this.stopHLSStream(cameraId);
      
      // Aguardar um pouco antes de reiniciar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Iniciar novamente
      return await this.startHLSStream(cameraId, inputUrl);
      
    } catch (error) {
      console.error(`❌ Erro ao reiniciar stream [${cameraId}]:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Falha ao reiniciar stream'
      };
    }
  }

  /**
   * Obter configurações de qualidade para FFmpeg
   * @param {string} quality - Qualidade: 'low', 'medium', 'high', 'ultra', 'mobile'
   * @returns {Object} Configurações do FFmpeg
   */
  getQualityConfig(quality) {
    switch (quality) {
      case 'mobile':
        return {
          resolution: '480x360',
          framerate: 8,
          maxrate: '400k',
          bufsize: '800k',
          preset: 'ultrafast',
          crf: 35,
          audioBitrate: '32k',
          description: 'Móvel (480x360, 8fps)'
        };
      case 'low':
        return {
          resolution: '480x360',
          framerate: 8,
          maxrate: '500k',
          bufsize: '1000k',
          preset: 'ultrafast',
          crf: 35,
          audioBitrate: '32k',
          description: 'Baixa (480x360, 8fps)'
        };
      case 'medium':
        return {
          resolution: '640x480',
          framerate: 12,
          maxrate: '800k',
          bufsize: '1600k',
          preset: 'ultrafast',
          crf: 32,
          audioBitrate: '48k',
          description: 'Média (640x480, 12fps)'
        };
      case 'high':
        return {
          resolution: '1280x720',
          framerate: 15,
          maxrate: '1500k',
          bufsize: '3000k',
          preset: 'superfast',
          crf: 28,
          audioBitrate: '64k',
          description: 'Alta (720p, 15fps)'
        };
      case 'ultra':
        return {
          resolution: '1920x1080',
          framerate: 20,
          maxrate: '2500k',
          bufsize: '5000k',
          preset: 'fast',
          crf: 25,
          audioBitrate: '96k',
          description: 'Ultra (1080p, 20fps)'
        };
      default:
        return this.getQualityConfig('medium');
    }
  }

  /**
   * Sistema de auto-start para câmeras online
   * @param {Array} cameras - Lista de câmeras do backend
   */
  async autoStartOnlineCameras(cameras) {
    console.log(`🔄 Verificando auto-start para ${cameras.length} câmeras...`);
    
    for (const camera of cameras) {
      try {
        // Verificar se câmera já tem stream ativo
        if (this.activeStreams.has(camera.id)) {
          console.log(`✅ Câmera ${camera.name || camera.id} já tem stream ativo`);
          
          // Garantir que o status está atualizado como online
          await this.updateCameraStatus(camera.id, 'online', this.getHLSUrl(camera.id));
          continue;
        }
        
        // Determinar URL de stream
        let streamUrl = null;
        let protocol = null;
        
        if (camera.rtspUrl && camera.rtspUrl.trim() !== '') {
          streamUrl = camera.rtspUrl;
          protocol = 'RTSP';
        } else if (camera.rtmpUrl && camera.rtmpUrl.trim() !== '') {
          streamUrl = camera.rtmpUrl;
          protocol = 'RTMP';
        }
        
        if (!streamUrl) {
          console.log(`⚠️ Câmera ${camera.name || camera.id} não tem URL configurada`);
          await this.updateCameraStatus(camera.id, 'offline');
          continue;
        }
        
        console.log(`🎬 Tentando iniciar stream para câmera ${camera.name || camera.id} (${protocol}): ${streamUrl}`);
        
        // Iniciar stream
        const result = await this.startHLSStream(camera.id, streamUrl, {
          protocol: protocol,
          quality: camera.quality || 'medium'
        });
        
        if (result.success) {
          console.log(`✅ Stream iniciado com sucesso para câmera ${camera.name || camera.id}`);
          await this.updateCameraStatus(camera.id, 'online', result.hlsUrl);
        } else {
          console.log(`❌ Falha ao iniciar stream para câmera ${camera.name || camera.id}: ${result.message}`);
          await this.updateCameraStatus(camera.id, 'offline');
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar câmera ${camera.name || camera.id}:`, error.message);
        await this.updateCameraStatus(camera.id, 'offline');
      }
    }
    
    console.log(`✅ Auto-start concluído para ${cameras.length} câmeras`);
  }

  /**
   * Verifica se uma câmera está online
   * @param {Object} camera - Dados da câmera
   * @returns {Promise<boolean>} True se online
   */
  async checkCameraOnline(camera) {
    try {
      const inputUrl = camera.rtspUrl || camera.rtmpUrl;
      if (!inputUrl) return false;
      
      // Para câmeras reais, tentar fazer uma verificação rápida
      return new Promise((resolve) => {
        const timeoutMs = 5000; // 5 segundos timeout
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, timeoutMs);
        
        // Tentar conectar rapidamente usando FFprobe
        const ffprobeArgs = [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-i', inputUrl
        ];
        
        const ffprobeProcess = spawn(ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe'), ffprobeArgs);
        
        ffprobeProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(code === 0);
          }
        });
        
        ffprobeProcess.on('error', () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });
      });
      
    } catch (error) {
      console.error(`❌ Erro ao verificar status da câmera ${camera.name || camera.id}:`, error.message);
      return false;
    }
  }

  /**
   * Inicializar monitoramento automático das câmeras
   * @param {Function} getCamerasCallback - Função para obter lista de câmeras
   */
  startAutoMonitoring(getCamerasCallback) {
    console.log(`🤖 Iniciando monitoramento automático de câmeras...`);
    
    // Executar auto-start inicial após 10 segundos
    setTimeout(async () => {
      try {
        const cameras = await getCamerasCallback();
        await this.autoStartOnlineCameras(cameras);
      } catch (error) {
        console.error('❌ Erro no auto-start inicial:', error.message);
      }
    }, 10000);
    
    // Executar verificação periódica a cada 2 minutos
    setInterval(async () => {
      try {
        const cameras = await getCamerasCallback();
        await this.autoStartOnlineCameras(cameras);
      } catch (error) {
        console.error('❌ Erro no auto-start periódico:', error.message);
      }
    }, 120000); // 2 minutos

    // 🆕 Health check e reconexão automática a cada 30 segundos
    setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // 30 segundos
  }

  /**
   * 🆕 Realizar verificações de saúde dos streams ativos
   */
  async performHealthChecks() {
    console.log(`🔍 Realizando health checks em ${this.activeStreams.size} streams...`);
    
    for (const [cameraId, streamInfo] of this.activeStreams) {
      try {
        const isHealthy = await this.checkStreamHealth(cameraId, streamInfo);
        
        if (!isHealthy) {
          console.log(`⚠️ Stream não saudável detectado [${cameraId}], iniciando reconexão...`);
          await this.reconnectStream(cameraId, streamInfo);
        } else {
          // Atualizar timestamp do último health check
          streamInfo.lastHealthCheck = new Date();
          streamInfo.consecutiveFailures = 0;
          this.activeStreams.set(cameraId, streamInfo);
        }
        
      } catch (error) {
        console.error(`❌ Erro no health check [${cameraId}]:`, error.message);
      }
    }
  }

  /**
   * 🆕 Verificar saúde de um stream específico
   * @param {string} cameraId - ID da câmera
   * @param {Object} streamInfo - Informações do stream
   * @returns {Promise<boolean>} True se saudável
   */
  async checkStreamHealth(cameraId, streamInfo) {
    try {
      // Verificar se o processo ainda está rodando
      if (streamInfo.process && streamInfo.process.killed) {
        console.log(`❌ Processo FFmpeg morto [${cameraId}]`);
        return false;
      }

      // Verificar se arquivos HLS estão sendo atualizados
      const cameraStreamDir = path.join(this.streamDirectory, cameraId);
      const m3u8Path = path.join(cameraStreamDir, 'stream.m3u8');
      
      if (!fs.existsSync(m3u8Path)) {
        console.log(`❌ Arquivo m3u8 não encontrado [${cameraId}]`);
        return false;
      }

      // Verificar se arquivo foi modificado nos últimos 10 segundos
      const stats = fs.statSync(m3u8Path);
      const lastModified = stats.mtime;
      const now = new Date();
      const timeDiff = (now - lastModified) / 1000; // segundos

      if (timeDiff > 10) {
        console.log(`⚠️ Arquivo m3u8 não atualizado há ${timeDiff.toFixed(1)}s [${cameraId}]`);
        return false;
      }

      // Verificar se há segmentos recentes
      const content = fs.readFileSync(m3u8Path, 'utf8');
      const segments = content.split('\n').filter(line => line.includes('.ts'));
      
      if (segments.length === 0) {
        console.log(`❌ Nenhum segmento encontrado no m3u8 [${cameraId}]`);
        return false;
      }

      // Verificar se último segmento existe e não está vazio
      const lastSegment = segments[segments.length - 1];
      const segmentPath = path.join(cameraStreamDir, lastSegment);
      
      if (!fs.existsSync(segmentPath)) {
        console.log(`❌ Último segmento não encontrado: ${lastSegment} [${cameraId}]`);
        return false;
      }

      const segmentStats = fs.statSync(segmentPath);
      if (segmentStats.size < 1000) { // Menos de 1KB
        console.log(`⚠️ Segmento muito pequeno: ${segmentStats.size} bytes [${cameraId}]`);
        return false;
      }

      console.log(`✅ Stream saudável [${cameraId}] - Último segmento: ${lastSegment} (${segmentStats.size} bytes)`);
      return true;

    } catch (error) {
      console.error(`❌ Erro no health check [${cameraId}]:`, error.message);
      return false;
    }
  }

  /**
   * 🆕 Reconectar stream problemático
   * @param {string} cameraId - ID da câmera
   * @param {Object} streamInfo - Informações do stream
   */
  async reconnectStream(cameraId, streamInfo) {
    try {
      console.log(`🔄 Iniciando reconexão automática [${cameraId}]...`);
      
      // Incrementar contador de falhas consecutivas
      streamInfo.consecutiveFailures = (streamInfo.consecutiveFailures || 0) + 1;
      streamInfo.lastFailure = new Date();
      
      // Limite de tentativas de reconexão
      const maxRetries = 5;
      if (streamInfo.consecutiveFailures > maxRetries) {
        console.error(`❌ Limite de reconexões excedido [${cameraId}] (${streamInfo.consecutiveFailures}/${maxRetries})`);
        console.log(`⏸️ Pausando stream [${cameraId}] por 5 minutos...`);
        
        // Parar o stream e agendar nova tentativa em 5 minutos
        this.stopHLSStream(cameraId);
        
        setTimeout(async () => {
          console.log(`🔄 Tentativa de reconexão agendada [${cameraId}]...`);
          streamInfo.consecutiveFailures = 0;
          await this.startHLSStream(cameraId, streamInfo.inputUrl);
        }, 300000); // 5 minutos
        
        return;
      }

      console.log(`🔄 Tentativa ${streamInfo.consecutiveFailures}/${maxRetries} de reconexão [${cameraId}]`);
      
      // Parar stream atual
      this.stopHLSStream(cameraId);
      
      // Aguardar antes de reconectar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tentar reconectar
      const result = await this.startHLSStream(cameraId, streamInfo.inputUrl, {
        quality: streamInfo.quality || 'medium',
        reconnection: true,
        attempt: streamInfo.consecutiveFailures
      });
      
      if (result.success) {
        console.log(`✅ Reconexão bem-sucedida [${cameraId}]`);
        streamInfo.consecutiveFailures = 0;
        streamInfo.lastReconnection = new Date();
      } else {
        console.error(`❌ Falha na reconexão [${cameraId}]:`, result.message);
      }
      
    } catch (error) {
      console.error(`❌ Erro durante reconexão [${cameraId}]:`, error.message);
    }
  }

  /**
   * 🆕 Alterar qualidade de um stream ativo
   * @param {string} cameraId - ID da câmera
   * @param {string} newQuality - Nova qualidade
   * @returns {Promise<Object>} Resultado da operação
   */
  async changeStreamQuality(cameraId, newQuality) {
    try {
      console.log(`🎯 Alterando qualidade do stream [${cameraId}] para: ${newQuality}`);
      
      const streamInfo = this.activeStreams.get(cameraId);
      if (!streamInfo) {
        return {
          success: false,
          message: 'Stream não encontrado'
        };
      }

      const newQualityConfig = this.getQualityConfig(newQuality);
      console.log(`🔧 Nova configuração:`, newQualityConfig);

      // Parar stream atual
      this.stopHLSStream(cameraId);
      
      // Aguardar mais tempo para garantir que o stream anterior foi completamente parado
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentado de 1000ms para 2000ms
      
      // Reiniciar com nova qualidade
      const result = await this.startHLSStream(cameraId, streamInfo.inputUrl, {
        quality: newQuality,
        qualityChange: true
      });
      
      if (result.success) {
        console.log(`✅ Qualidade alterada com sucesso [${cameraId}] → ${newQualityConfig.description}`);
        return {
          success: true,
          message: `Qualidade alterada para ${newQualityConfig.description}`,
          newQuality: newQuality,
          config: newQualityConfig
        };
      } else {
        return {
          success: false,
          message: 'Falha ao reiniciar stream com nova qualidade'
        };
      }
      
    } catch (error) {
      console.error(`❌ Erro ao alterar qualidade [${cameraId}]:`, error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 🆕 Obter configurações de qualidade disponíveis
   * @returns {Array} Lista de qualidades disponíveis
   */
  getAvailableQualities() {
    return [
      { id: 'mobile', name: 'Móvel', ...this.getQualityConfig('mobile') },
      { id: 'low', name: 'Baixa', ...this.getQualityConfig('low') },
      { id: 'medium', name: 'Média', ...this.getQualityConfig('medium') },
      { id: 'high', name: 'Alta', ...this.getQualityConfig('high') },
      { id: 'ultra', name: 'Ultra', ...this.getQualityConfig('ultra') }
    ];
  }

  /**
   * Atualizar status da câmera no banco de dados
   * @param {string} cameraId - ID da câmera
   * @param {string} status - Status da câmera (online/offline)
   * @param {string} hlsUrl - URL HLS (opcional)
   */
  async updateCameraStatus(cameraId, status, hlsUrl = null) {
    try {
      const { supabase } = require('./supabase');
      
      console.log(`🔄 Atualizando status da câmera ${cameraId}: ${status}`);
      
      const updateData = {
        status: status,
        updatedAt: new Date().toISOString()
      };
      
      // Se fornecida, atualizar também a URL HLS
      if (hlsUrl) {
        updateData.hlsUrl = hlsUrl;
        updateData.streamStatus = 'ACTIVE';
      } else if (status === 'offline') {
        updateData.streamStatus = 'INACTIVE';
        updateData.hlsUrl = null;
      }
      
      const { error } = await supabase
        .from('cameras')
        .update(updateData)
        .eq('id', cameraId);
      
      if (error) {
        console.error(`❌ Erro ao atualizar status da câmera ${cameraId}:`, error.message);
        return false;
      }
      
      console.log(`✅ Status da câmera ${cameraId} atualizado para: ${status}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro geral ao atualizar status da câmera ${cameraId}:`, error.message);
      return false;
    }
  }
}

// Singleton instance
const streamingService = new StreamingService();

module.exports = streamingService;