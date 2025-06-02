const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');

const rtspUrl = "rtsp://visualizar:infotec5384@186.233.4.80:554/cam/realmonitor?channel=1&subtype=0";
const outputPath = "./debug-current.mp4";

console.log('🔍 Debugando gravação atual...');
console.log('📹 URL:', rtspUrl);
console.log('💾 Arquivo de saída:', outputPath);

// Usar exatamente as mesmas configurações do worker
const ffmpegArgs = [
  '-rtsp_transport', 'tcp',
  '-timeout', '10000000',   // 10 segundos de timeout
  '-i', rtspUrl,
  '-t', '30', // 30 segundos para debug
  '-c:v', 'copy',           // Copy stream sem recodificar (mais rápido)
  '-c:a', 'copy',           // Copy áudio sem recodificar
  '-f', 'mp4',
  '-avoid_negative_ts', 'make_zero',
  '-movflags', '+faststart', // Para streaming web
  outputPath
];

console.log('🔧 Comando FFmpeg:', ffmpegStatic, ffmpegArgs.join(' '));

const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs);

let outputReceived = false;

ffmpegProcess.stdout.on('data', (data) => {
  console.log(`📺 FFmpeg stdout: ${data.toString().trim()}`);
  outputReceived = true;
});

ffmpegProcess.stderr.on('data', (data) => {
  console.log(`📺 FFmpeg stderr: ${data.toString().trim()}`);
  outputReceived = true;
});

ffmpegProcess.on('close', (code) => {
  console.log(`🏁 FFmpeg finalizado com código: ${code}`);
  
  // Verificar se o arquivo foi criado
  const fs = require('fs');
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log(`✅ Arquivo criado: ${outputPath} (${stats.size} bytes)`);
  } else {
    console.log(`❌ Arquivo não foi criado: ${outputPath}`);
  }
  
  if (!outputReceived) {
    console.log('⚠️ Nenhuma saída foi recebida do FFmpeg!');
  }
  
  process.exit(code);
});

ffmpegProcess.on('error', (error) => {
  console.error(`❌ Erro no processo FFmpeg:`, error);
  process.exit(1);
});

// Timeout de segurança
setTimeout(() => {
  console.log('⏰ Timeout de 40 segundos atingido, encerrando...');
  ffmpegProcess.kill('SIGTERM');
}, 40000);

// Verificar tamanho do arquivo periodicamente
const checkFileSize = () => {
  try {
    const fs = require('fs');
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`📊 Tamanho atual: ${stats.size} bytes`);
    }
  } catch (error) {
    // Ignorar erros de arquivo não existente
  }
};

setInterval(checkFileSize, 5000); // A cada 5 segundos 