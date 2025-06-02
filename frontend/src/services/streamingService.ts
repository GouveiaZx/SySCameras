import { StreamConfig, StreamQuality } from '@/components/stream/StreamConfigForm'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3002'

export interface StartStreamRequest {
  cameraId: string
  rtspUrl: string // Mantém nome original para compatibilidade com backend
  cameraName?: string
  quality?: StreamQuality
}

export interface StartStreamResponse {
  success: boolean
  message: string
  data?: {
    cameraId: string
    cameraName: string
    hlsUrl: string
    streamInfo: {
      cameraId: string
      status: string
      startTime: string
      type?: string
    }
  }
  error?: string
}

export interface StreamStatus {
  active: boolean
  status: string
  startTime?: string
  rtspUrl?: string
  hlsUrl?: string
  uptime?: number
}

export interface ActiveStreamsResponse {
  success: boolean
  data: {
    totalStreams: number
    streams: Array<{
      cameraId: string
      status: string
      startTime: string
      hlsUrl: string
      uptime: number
    }>
  }
}

// Configurações de qualidade para FFmpeg
const getQualityConfig = (quality: StreamQuality) => {
  switch (quality) {
    case 'low':
      return {
        resolution: '480x360',
        framerate: 8,
        bitrate: '600k',
        preset: 'superfast',
        crf: 35
      }
    case 'medium':
      return {
        resolution: '640x360',
        framerate: 12,
        bitrate: '1200k',
        preset: 'fast',
        crf: 32
      }
    case 'high':
      return {
        resolution: '854x480',
        framerate: 15,
        bitrate: '2000k',
        preset: 'medium',
        crf: 28
      }
    default:
      return getQualityConfig('medium')
  }
}

class StreamingService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${WORKER_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async startStream(config: StreamConfig): Promise<StartStreamResponse> {
    try {
      console.log('🎬 Iniciando stream:', config)

      // Gerar ID único baseado no nome da câmera
      const cameraId = `camera-${config.cameraName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`
      
      const request: StartStreamRequest = {
        cameraId,
        rtspUrl: config.url, // Usa o nome original esperado pelo backend
        cameraName: config.cameraName,
        quality: config.quality
      }

      const result = await this.makeRequest<StartStreamResponse>('/api/streams/start', {
        method: 'POST',
        body: JSON.stringify(request),
      })

      console.log('✅ Stream iniciado:', result)
      return result

    } catch (error) {
      console.error('❌ Erro ao iniciar stream:', error)
      throw error
    }
  }

  async stopStream(cameraId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🛑 Parando stream:', cameraId)

      const result = await this.makeRequest<{ success: boolean; message: string }>('/api/streams/stop', {
        method: 'POST',
        body: JSON.stringify({ cameraId }),
      })

      console.log('✅ Stream parado:', result)
      return result

    } catch (error) {
      console.error('❌ Erro ao parar stream:', error)
      throw error
    }
  }

  async getStreamStatus(cameraId: string): Promise<StreamStatus> {
    try {
      const result = await this.makeRequest<StreamStatus>(`/api/streams/${cameraId}/status`)
      return result
    } catch (error) {
      console.error('❌ Erro ao obter status do stream:', error)
      throw error
    }
  }

  async getActiveStreams(): Promise<ActiveStreamsResponse> {
    try {
      const result = await this.makeRequest<ActiveStreamsResponse>('/api/streams/active')
      return result
    } catch (error) {
      console.error('❌ Erro ao listar streams ativos:', error)
      throw error
    }
  }

  async getWorkerStatus(): Promise<any> {
    try {
      const result = await this.makeRequest<any>('/api/worker/status')
      return result
    } catch (error) {
      console.error('❌ Erro ao obter status do worker:', error)
      throw error
    }
  }

  // Testar conexão com uma URL
  async testConnection(url: string): Promise<boolean> {
    try {
      // Implementar teste de conexão se necessário
      // Por enquanto, apenas validar formato da URL
      const isValidRTSP = url.toLowerCase().startsWith('rtsp://')
      const isValidRTMP = url.toLowerCase().startsWith('rtmp://')
      return isValidRTSP || isValidRTMP
    } catch (error) {
      return false
    }
  }

  // Obter configurações de qualidade
  getQualityConfig(quality: StreamQuality) {
    return getQualityConfig(quality)
  }

  // Gerar URL HLS para preview
  getHLSUrl(cameraId: string): string {
    return `${WORKER_URL}/hls/${cameraId}/stream.m3u8`
  }

  // Alias para getStreamStatus para compatibilidade
  async getHLSStreamStatus(cameraId: string, token?: string): Promise<StreamStatus> {
    return this.getStreamStatus(cameraId)
  }

  // Alternar estado do stream HLS (iniciar/parar)
  async toggleHLSStream(cameraId: string, token?: string, rtspUrl?: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔄 Alternando stream HLS para câmera:', cameraId)

      // Primeiro verificar o status atual
      const currentStatus = await this.getStreamStatus(cameraId).catch(() => ({ active: false }))
      
      if (currentStatus.active) {
        // Se ativo, parar
        return await this.stopStream(cameraId)
      } else {
        // Se inativo, tentar iniciar com configuração padrão
        if (!rtspUrl) {
          throw new Error('URL RTSP é obrigatória para iniciar o stream. Verifique se a câmera tem uma URL RTSP configurada.')
        }
        
        // Usar configuração básica para compatibilidade
        const streamConfig: StreamConfig = {
          cameraName: `Camera-${cameraId}`,
          url: rtspUrl, // Usar URL RTSP real passada como parâmetro
          protocol: 'rtsp' as any,
          quality: 'medium' as StreamQuality
        }
        
        const startRequest: StartStreamRequest = {
          cameraId: cameraId, // Usar ID da câmera existente
          rtspUrl: streamConfig.url,
          cameraName: streamConfig.cameraName,
          quality: streamConfig.quality
        }

        console.log('🎬 Iniciando stream com dados:', startRequest)

        const result = await this.makeRequest<StartStreamResponse>('/api/streams/start', {
          method: 'POST',
          body: JSON.stringify(startRequest),
        })

        console.log('✅ Stream iniciado via toggle:', result)
        return {
          success: result.success,
          message: result.message || 'Stream HLS iniciado com sucesso',
          data: result.data
        }
      }

    } catch (error: any) {
      console.error('❌ Erro ao alternar stream HLS:', error)
      
      // Se for erro de configuração, dar dica útil
      if (error.message?.includes('configuração')) {
        return {
          success: false,
          message: 'Use a página "Config Stream" para configurar protocolos e qualidade, depois use este botão para alternar.',
          data: null
        }
      }
      
      throw error
    }
  }

  // Formatar tempo de uptime em formato legível
  formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }
}

// Singleton instance
export const streamingService = new StreamingService()
export default streamingService 