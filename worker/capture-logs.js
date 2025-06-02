const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Capturando logs do worker em tempo real...');

// Matar qualquer processo existente na porta 3002
const killExisting = spawn('taskkill', ['/F', '/FI', 'WINDOWTITLE eq *node*', '/FI', 'PID ne 0']);

killExisting.on('close', () => {
  console.log('📋 Processos anteriores encerrados');
  
  // Aguardar um pouco e iniciar o worker
  setTimeout(() => {
    console.log('🚀 Iniciando worker com logs...');
    
    const workerProcess = spawn('node', ['src/server.js'], {
      cwd: __dirname,
      stdio: 'inherit' // Mostrar logs diretamente
    });
    
    workerProcess.on('error', (error) => {
      console.error('❌ Erro no worker:', error);
    });
    
    workerProcess.on('exit', (code) => {
      console.log(`🏁 Worker finalizado com código: ${code}`);
    });
    
    // Permitir encerramento gracioso
    process.on('SIGINT', () => {
      console.log('\n🛑 Encerrando worker...');
      workerProcess.kill('SIGTERM');
      process.exit(0);
    });
    
  }, 2000);
}); 