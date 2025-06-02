require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const streamingService = require('./services/streamingService');
const recordingController = require('./controllers/recordingController');
const { startContinuousRecording, stopContinuousRecording } = require('./recording-service');
const {
  startStream,
  stopStream,
  getStreamStatus,
  getActiveStreams,
  getWorkerStatus,
  changeStreamQuality,
  getAvailableQualities,
  forceReconnect,
  getStreamHealth
} = require('./controllers/streamController');

const app = express();
const PORT = process.env.WORKER_PORT || 3002;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para requisições OPTIONS (CORS preflight)
app.options('*', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  res.set('Access-Control-Max-Age', '3600');
  res.status(200).end();
});

// Middleware de log
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Servir arquivos HLS estáticos
const streamsPath = path.join(__dirname, '../streams');
app.use('/hls', express.static(streamsPath, {
  setHeaders: (res, path) => {
    // Headers específicos para HLS
    if (path.endsWith('.m3u8')) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else if (path.endsWith('.ts')) {
      res.set('Content-Type', 'video/mp2t');
      res.set('Cache-Control', 'max-age=30');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    
    // Headers CORS específicos
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.set('Access-Control-Max-Age', '3600');
  }
}));

// Servir arquivos de gravação locais
const recordingsPath = path.join(__dirname, '../tmp');
app.use('/recordings', express.static(recordingsPath, {
  setHeaders: (res, filePath) => {
    // Headers para arquivos de vídeo
    if (filePath.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
      res.set('Accept-Ranges', 'bytes');
      res.set('Cache-Control', 'public, max-age=3600');
    }
    
    // Headers CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Range');
    res.set('Access-Control-Max-Age', '3600');
  }
}));

// OPTIONS para endpoints de recordings
app.options('/api/recordings/stream/:filename', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Range',
    'Access-Control-Max-Age': '3600'
  });
  res.status(204).end();
});

app.options('/api/recordings/download/:filename', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Range',
    'Access-Control-Max-Age': '3600'
  });
  res.status(204).end();
});

// Endpoint específico para download de gravações
app.get('/api/recordings/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../tmp', filename);
    
    console.log(`📥 Download solicitado: ${filename}`);
    
    // Verificar se arquivo existe
    if (!require('fs').existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${filename}`);
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }
    
    // Headers para forçar download
    res.set('Content-Type', 'video/mp4');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Expose-Headers', 'Content-Disposition');
    
    console.log(`✅ Iniciando download: ${filename}`);
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('❌ Erro no download:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Endpoint específico para streaming/reprodução de gravações com caminho completo
app.get('/api/recordings/stream/*', (req, res) => {
  try {
    // Extrair o caminho completo após /api/recordings/stream/
    const fullPath = req.params[0]; // Express captura tudo após * como params[0]
    
    console.log(`🎬 Stream solicitado (caminho completo): ${fullPath}`);
    
    let filePath;
    
    // Se o caminho começa com worker/tmp/, usar diretamente
    if (fullPath.startsWith('worker/tmp/')) {
      // Remover 'worker/' do início pois já estamos na pasta worker
      const relativePath = fullPath.replace('worker/', '');
      filePath = path.join(__dirname, '..', relativePath);
    } else if (fullPath.startsWith('tmp/')) {
      // Se começa com tmp/, usar diretamente
      filePath = path.join(__dirname, '..', fullPath);
    } else {
      // Assumir que é apenas o filename e procurar nas subpastas
      const filename = path.basename(fullPath);
      filePath = path.join(__dirname, '../tmp', filename);
      
      // Se não encontrar, procurar nas subpastas de câmeras
      if (!require('fs').existsSync(filePath)) {
        const fsSync = require('fs');
        const tmpDir = path.join(__dirname, '../tmp');
        
        try {
          const subdirs = fsSync.readdirSync(tmpDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          for (const subdir of subdirs) {
            const possiblePath = path.join(tmpDir, subdir, filename);
            if (fsSync.existsSync(possiblePath)) {
              filePath = possiblePath;
              console.log(`📁 Arquivo encontrado em: ${subdir}/${filename}`);
              break;
            }
          }
        } catch (err) {
          console.error('❌ Erro ao procurar em subpastas:', err);
        }
      }
    }
    
    console.log(`🔍 Caminho final do arquivo: ${filePath}`);
    
    // Verificar se o arquivo existe
    if (!require('fs').existsSync(filePath)) {
      console.error(`❌ Arquivo não encontrado: ${filePath}`);
      return res.status(404).json({ 
        error: 'Arquivo não encontrado',
        path: filePath 
      });
    }
    
    // Obter estatísticas do arquivo
    const stat = require('fs').statSync(filePath);
    const fileSize = stat.size;
    
    // Headers para suporte a range requests (importante para vídeo)
    const range = req.headers.range;
    
    if (range) {
      // Parse do range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      console.log(`📊 Range request: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
      
      // Stream com range
      const stream = require('fs').createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range'
      });
      
      stream.pipe(res);
    } else {
      // Stream completo
      console.log(`📤 Servindo arquivo completo: ${fileSize} bytes`);
      
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range'
      });
      
      require('fs').createReadStream(filePath).pipe(res);
    }
    
  } catch (error) {
    console.error('❌ Erro ao servir stream:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

// Rotas da API de streaming
app.post('/api/streams/start', startStream);
app.post('/api/streams/start-with-url', async (req, res) => {
  try {
    const { cameraId, streamUrl, options = {} } = req.body;
    
    console.log(`🎬 Iniciando stream com URL específica para câmera ${cameraId}`);
    console.log(`📡 URL: ${streamUrl}`);
    console.log(`⚙️ Opções:`, options);
    
    if (!cameraId || !streamUrl) {
      return res.status(400).json({
        success: false,
        message: 'cameraId e streamUrl são obrigatórios'
      });
    }
    
    const result = await streamingService.startHLSStream(cameraId, streamUrl, options);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Stream ${options.protocol || 'HLS'} iniciado com sucesso`,
        data: {
          cameraId,
          streamUrl,
          hlsUrl: result.hlsUrl,
          protocol: options.protocol,
          quality: options.quality || 'medium',
          streamInfo: result.streamInfo
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Erro ao iniciar stream',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao iniciar stream com URL específica:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});
app.post('/api/streams/stop', stopStream);
app.get('/api/streams/:cameraId/status', getStreamStatus);
app.get('/api/streams/active', getActiveStreams);
app.get('/api/worker/status', getWorkerStatus);

// === ROTAS DE GRAVAÇÃO ===

// Iniciar gravação contínua
app.post('/recording/start', async (req, res) => {
  try {
    const { camera } = req.body;
    
    if (!camera || !camera.id) {
      return res.status(400).json({
        success: false,
        message: 'Dados da câmera são obrigatórios'
      });
    }
    
    console.log(`🎬 Iniciando gravação contínua para câmera: ${camera.id}`);
    
    const result = await startContinuousRecording(camera);
    
    res.json({
      success: true,
      message: 'Gravação contínua iniciada com sucesso',
      cameraId: camera.id,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar gravação contínua:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar gravação contínua',
      error: error.message
    });
  }
});

// Parar gravação contínua
app.post('/recording/stop', async (req, res) => {
  try {
    const { cameraId } = req.body;
    
    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: 'cameraId é obrigatório'
      });
    }
    
    console.log(`🛑 Parando gravação contínua para câmera: ${cameraId}`);
    
    const result = await stopContinuousRecording(cameraId);
    
    res.json({
      success: true,
      message: 'Gravação contínua parada com sucesso',
      cameraId,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Erro ao parar gravação contínua:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao parar gravação contínua',
      error: error.message
    });
  }
});

// Rotas do controller de gravação (compatibilidade)
app.post('/api/recordings/start', recordingController.startRecording);
app.post('/api/recordings/:cameraId/stop', recordingController.stopRecording);
app.get('/api/recordings/active', recordingController.getActiveRecordings);
app.post('/api/recordings/schedule', recordingController.scheduleRecording);

// 🆕 Novas rotas para qualidade adaptativa
app.post('/api/streams/:cameraId/quality', changeStreamQuality);
app.get('/api/streams/qualities', getAvailableQualities);
app.post('/api/streams/:cameraId/reconnect', forceReconnect);
app.get('/api/streams/:cameraId/health', getStreamHealth);

// Rota de healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Rota para iniciar stream automaticamente de câmeras online
app.post('/api/auto-start-streams', async (req, res) => {
  try {
    const { supabase } = require('./services/supabase');
    
    // Buscar câmeras online com RTSP
    const { data: cameras, error } = await supabase
      .from('cameras')
      .select('id, name, rtspUrl, status')
      .eq('status', 'online')
      .not('rtspUrl', 'is', null);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar câmeras',
        error: error.message
      });
    }

    console.log(`🎬 Iniciando streams automáticos para ${cameras.length} câmeras online`);

    const results = [];
    
    for (const camera of cameras) {
      try {
        const result = await streamingService.startHLSStream(camera.id, camera.rtspUrl);
        
        if (result.success) {
          // Atualizar URL HLS no banco
          await supabase
            .from('cameras')
            .update({ 
              hlsUrl: result.hlsUrl,
              streamStatus: 'ACTIVE'
            })
            .eq('id', camera.id);
        }
        
        results.push({
          cameraId: camera.id,
          cameraName: camera.name,
          success: result.success,
          hlsUrl: result.hlsUrl,
          message: result.message
        });
        
      } catch (error) {
        results.push({
          cameraId: camera.id,
          cameraName: camera.name,
          success: false,
          error: error.message
        });
      }
    }

    const successfulStreams = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `${successfulStreams}/${cameras.length} streams iniciados com sucesso`,
      results
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar streams automáticos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// Função para buscar câmeras do backend
async function getCamerasFromBackend() {
  try {
    const { supabase } = require('./services/supabase');
    
    console.log('🔍 Buscando câmeras online do Supabase...');
    
    // Buscar câmeras que têm URL configurada (RTSP ou RTMP)
    const { data: cameras, error } = await supabase
      .from('cameras')
      .select('id, name, type, rtspUrl, rtmpUrl, status, createdAt')
      .or('rtspUrl.not.is.null,rtmpUrl.not.is.null');

    if (error) {
      console.error('❌ Erro ao buscar câmeras do Supabase:', error.message);
      return [];
    }

    if (!cameras || cameras.length === 0) {
      console.log('⚠️ Nenhuma câmera encontrada no banco de dados');
      return [];
    }

    // Converter para formato esperado pelo worker
    const formattedCameras = cameras.map(camera => ({
      id: camera.id,
      name: camera.name,
      type: camera.type,
      rtspUrl: camera.rtspUrl,
      rtmpUrl: camera.rtmpUrl,
      status: camera.status || 'offline',
      isOnline: camera.status === 'online',
      quality: 'medium' // Qualidade padrão
    }));

    console.log(`✅ Encontradas ${formattedCameras.length} câmeras no banco:`);
    formattedCameras.forEach(camera => {
      const url = camera.rtspUrl || camera.rtmpUrl || 'Sem URL';
      console.log(`  📹 ${camera.name} (${camera.id}) - ${url} - Status: ${camera.status}`);
    });

    return formattedCameras;
    
  } catch (error) {
    console.error('❌ Erro ao buscar câmeras do backend:', error.message);
    return [];
  }
}

// Middleware de tratamento de erro 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    path: req.url
  });
});

// Middleware de tratamento de erro global
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Worker streaming server rodando na porta ${PORT}`);
  console.log(`📡 Endpoint HLS: http://localhost:${PORT}/hls/`);
  console.log(`🔧 API Status: http://localhost:${PORT}/api/worker/status`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  
  // Inicializar sistema de auto-start de câmeras
  console.log(`🤖 Inicializando sistema de auto-start de câmeras...`);
  streamingService.startAutoMonitoring(getCamerasFromBackend);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, parando todos os streams...');
  streamingService.stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, parando todos os streams...');
  streamingService.stopAllStreams();
  process.exit(0);
});

module.exports = app; 