const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Wasabi S3 com AWS SDK v3
const s3Client = new S3Client({
  endpoint: 'https://s3.wasabisys.com',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '8WBR4YFE79UA94TBIEST',
    secretAccessKey: process.env.WASABI_SECRET_KEY || 'your-secret-key',
  },
  forcePathStyle: true
});

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://mmpipjndealyromdfnoa.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcGlwam5kZWFseXJvbWRmbm9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg0Nzk3NywiZXhwIjoyMDYzNDIzOTc3fQ.gHBER4v_A1HzfaqC2YlJHrVKGDcGB0RNejktoy3TvX8'
);

const BUCKET_NAME = 'safe-cameras-03';
const TEMP_DIR = path.join(__dirname, '../../temp');

// Garantir que o diretório temporário existe
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class RecordingService {
  constructor() {
    this.activeRecordings = new Map();
  }

  /**
   * Inicia gravação de uma câmera
   * @param {string} cameraId - ID da câmera
   * @param {string} rtspUrl - URL RTSP da câmera
   * @param {number} duration - Duração em segundos (padrão: 300 = 5 minutos)
   */
  async startRecording(cameraId, rtspUrl, duration = 300) {
    try {
      console.log(`🎬 Iniciando gravação da câmera ${cameraId}...`);

      // Verificar se já existe gravação ativa
      if (this.activeRecordings.has(cameraId)) {
        throw new Error('Gravação já está ativa para esta câmera');
      }

      // Gerar nome único para o arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `camera_${cameraId}_${timestamp}.mp4`;
      const localPath = path.join(TEMP_DIR, filename);

      // Criar registro no Supabase
      const { data: recording, error: dbError } = await supabase
        .from('recordings')
        .insert({
          cameraId,
          filename,
          status: 'RECORDING',
          startTime: new Date().toISOString(),
          duration: duration
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Erro ao criar registro: ${dbError.message}`);
      }

      // Configurar FFmpeg para gravação
      const ffmpegProcess = ffmpeg(rtspUrl)
        .inputOptions([
          '-rtsp_transport', 'tcp',
          '-stimeout', '5000000'
        ])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-t', duration.toString()
        ])
        .output(localPath)
        .on('start', (commandLine) => {
          console.log(`📹 FFmpeg iniciado: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(`📊 Progresso: ${progress.percent}% - ${progress.timemark}`);
        })
        .on('end', async () => {
          console.log(`✅ Gravação concluída: ${filename}`);
          await this.uploadToWasabi(recording.id, localPath, filename);
          this.activeRecordings.delete(cameraId);
        })
        .on('error', async (err) => {
          console.error(`❌ Erro na gravação: ${err.message}`);
          await this.handleRecordingError(recording.id, err.message);
          this.activeRecordings.delete(cameraId);
        });

      // Armazenar processo ativo
      this.activeRecordings.set(cameraId, {
        process: ffmpegProcess,
        recordingId: recording.id,
        localPath,
        filename
      });

      // Iniciar gravação
      ffmpegProcess.run();

      return {
        recordingId: recording.id,
        filename,
        status: 'RECORDING'
      };

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      throw error;
    }
  }

  /**
   * Para gravação ativa
   * @param {string} cameraId - ID da câmera
   */
  async stopRecording(cameraId) {
    try {
      const activeRecording = this.activeRecordings.get(cameraId);
      
      if (!activeRecording) {
        throw new Error('Nenhuma gravação ativa encontrada para esta câmera');
      }

      console.log(`⏹️ Parando gravação da câmera ${cameraId}...`);

      // Parar processo FFmpeg
      activeRecording.process.kill('SIGTERM');

      // Aguardar um pouco para o arquivo ser finalizado
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Upload do arquivo parcial
      await this.uploadToWasabi(
        activeRecording.recordingId,
        activeRecording.localPath,
        activeRecording.filename
      );

      this.activeRecordings.delete(cameraId);

      return {
        recordingId: activeRecording.recordingId,
        status: 'STOPPED'
      };

    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      throw error;
    }
  }

  /**
   * Upload do arquivo para Wasabi S3
   * @param {string} recordingId - ID do registro
   * @param {string} localPath - Caminho local do arquivo
   * @param {string} filename - Nome do arquivo
   */
  async uploadToWasabi(recordingId, localPath, filename) {
    try {
      console.log(`☁️ Iniciando upload para Wasabi: ${filename}`);

      // Verificar se o arquivo existe
      if (!fs.existsSync(localPath)) {
        throw new Error('Arquivo local não encontrado');
      }

      const fileStats = fs.statSync(localPath);
      const fileStream = fs.createReadStream(localPath);

      // Configurar parâmetros do upload
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: `recordings/${filename}`,
        Body: fileStream,
        ContentType: 'video/mp4',
        Metadata: {
          'recording-id': recordingId,
          'upload-date': new Date().toISOString()
        }
      };

      // Fazer upload
      await s3Client.send(new PutObjectCommand(uploadParams));

      // Construir URL do arquivo
      const fileUrl = `https://s3.wasabisys.com/${BUCKET_NAME}/recordings/${filename}`;
      console.log(`✅ Upload concluído: ${fileUrl}`);

      // Atualizar registro no Supabase
      await supabase
        .from('recordings')
        .update({
          status: 'COMPLETED',
          endTime: new Date().toISOString(),
          fileUrl: fileUrl,
          fileSize: fileStats.size
        })
        .eq('id', recordingId);

      // Limpar arquivo local
      fs.unlinkSync(localPath);
      console.log(`🗑️ Arquivo local removido: ${localPath}`);

      return { Location: fileUrl };

    } catch (error) {
      console.error('Erro no upload:', error);
      
      // Marcar como erro no banco
      await supabase
        .from('recordings')
        .update({
          status: 'ERROR',
          endTime: new Date().toISOString(),
          errorMessage: error.message
        })
        .eq('id', recordingId);

      throw error;
    }
  }

  /**
   * Trata erros de gravação
   * @param {string} recordingId - ID do registro
   * @param {string} errorMessage - Mensagem de erro
   */
  async handleRecordingError(recordingId, errorMessage) {
    try {
      await supabase
        .from('recordings')
        .update({
          status: 'ERROR',
          endTime: new Date().toISOString(),
          errorMessage
        })
        .eq('id', recordingId);

      console.log(`❌ Erro registrado no banco: ${errorMessage}`);
    } catch (error) {
      console.error('Erro ao registrar erro no banco:', error);
    }
  }

  /**
   * Lista gravações ativas
   */
  getActiveRecordings() {
    const active = [];
    for (const [cameraId, recording] of this.activeRecordings) {
      active.push({
        cameraId,
        recordingId: recording.recordingId,
        filename: recording.filename
      });
    }
    return active;
  }

  /**
   * Agenda gravação automática
   * @param {string} cameraId - ID da câmera
   * @param {string} rtspUrl - URL RTSP
   * @param {Object} schedule - Configuração de agendamento
   */
  async scheduleRecording(cameraId, rtspUrl, schedule) {
    // Implementar lógica de agendamento baseada em cron
    console.log(`📅 Agendamento configurado para câmera ${cameraId}:`, schedule);
    
    // Por enquanto, apenas log - implementar com node-cron posteriormente
    return {
      cameraId,
      schedule,
      status: 'SCHEDULED'
    };
  }
}

module.exports = RecordingService; 