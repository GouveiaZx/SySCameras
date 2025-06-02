const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Middleware CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Range', 'Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
}));

// Middleware para logs
app.use((req, res, next) => {
  console.log(`📺 ${req.method} ${req.url}`);
  if (req.headers.range) {
    console.log(`   Range: ${req.headers.range}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'video-server',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Endpoint para servir vídeos
app.get('/video/*', (req, res) => {
  try {
    // Decodificar o caminho da URL
    const videoPath = decodeURIComponent(req.params[0]);
    const fullPath = path.join(__dirname, '..', videoPath);
    
    console.log(`🎥 Solicitação de vídeo: ${videoPath}`);
    console.log(`📁 Caminho completo: ${fullPath}`);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(fullPath)) {
      console.log('❌ Arquivo não encontrado');
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    
    console.log(`📊 Tamanho do arquivo: ${Math.round(fileSize / 1024 / 1024)}MB`);
    
    // Headers básicos para vídeo
    const headers = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // Processar Range requests (essencial para vídeo)
    const range = req.headers.range;
    
    if (range) {
      // Parse do range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      const chunksize = (end - start) + 1;
      
      console.log(`📡 Range request: ${start}-${end}/${fileSize} (${Math.round(chunksize/1024)}KB)`);
      
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      headers['Content-Length'] = chunksize;
      
      res.writeHead(206, headers);
      
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.log('❌ Erro no stream:', error.message);
        res.end();
      });
      
    } else {
      // Resposta completa do arquivo
      console.log('📡 Resposta completa do arquivo');
      
      headers['Content-Length'] = fileSize;
      res.writeHead(200, headers);
      
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.log('❌ Erro no stream:', error.message);
        res.end();
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no servidor de vídeo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para listar vídeos disponíveis
app.get('/videos', (req, res) => {
  try {
    const videosDir = path.join(__dirname, '..', 'tmp');
    const videos = [];
    
    if (fs.existsSync(videosDir)) {
      const cameraDirs = fs.readdirSync(videosDir);
      
      cameraDirs.forEach(cameraDir => {
        const cameraPath = path.join(videosDir, cameraDir);
        if (fs.statSync(cameraPath).isDirectory()) {
          const files = fs.readdirSync(cameraPath);
          
          files.forEach(file => {
            if (file.endsWith('.mp4')) {
              const filePath = path.join(cameraPath, file);
              const stat = fs.statSync(filePath);
              
              videos.push({
                name: file,
                path: `tmp/${cameraDir}/${file}`,
                url: `http://localhost:${PORT}/video/tmp/${cameraDir}/${encodeURIComponent(file)}`,
                size: stat.size,
                sizeMB: Math.round(stat.size / 1024 / 1024),
                created: stat.birthtime,
                modified: stat.mtime
              });
            }
          });
        }
      });
    }
    
    res.json({
      total: videos.length,
      videos: videos.sort((a, b) => new Date(b.created) - new Date(a.created))
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar vídeos:', error);
    res.status(500).json({ error: 'Erro ao listar vídeos' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🎬 Servidor de vídeo iniciado na porta ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Lista de vídeos: http://localhost:${PORT}/videos`);
});

module.exports = app; 