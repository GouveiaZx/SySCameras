const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

const rtspUrl = "rtsp://visualizar:infotec5384@186.233.4.80:554/cam/realmonitor?channel=1&subtype=0";
const outputPath = "./test-record.mp4";

console.log('🧪 Testando conectividade RTSP...');
console.log('📹 URL:', rtspUrl);
console.log('💾 Arquivo de saída:', outputPath);

const ffmpegArgs = [
  '-rtsp_transport', 'tcp',
  '-timeout', '10000000',   // 10 segundos de timeout
  '-i', rtspUrl,
  '-t', '5', // Reduzido para 5 segundos
  '-c:v', 'copy',  // Sem recodificação para ser mais rápido
  '-c:a', 'copy',  // Sem recodificação de áudio
  '-f', 'mp4',
  '-avoid_negative_ts', 'make_zero',
  outputPath
];

console.log('🔧 Comando FFmpeg:', ffmpegStatic, ffmpegArgs.join(' '));

const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs);

ffmpegProcess.stdout.on('data', (data) => {
  console.log(`📺 FFmpeg stdout: ${data.toString().trim()}`);
});

ffmpegProcess.stderr.on('data', (data) => {
  console.log(`📺 FFmpeg stderr: ${data.toString().trim()}`);
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
  
  process.exit(code);
});

ffmpegProcess.on('error', (error) => {
  console.error(`❌ Erro no processo FFmpeg:`, error);
  process.exit(1);
});

// Timeout de segurança reduzido
setTimeout(() => {
  console.log('⏰ Timeout de 20 segundos atingido, encerrando...');
  ffmpegProcess.kill('SIGTERM');
}, 20000); 