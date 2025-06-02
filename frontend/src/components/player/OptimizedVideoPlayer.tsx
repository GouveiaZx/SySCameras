'use client'

import { useState, useEffect, useRef } from 'react'
import ReactPlayer from 'react-player'
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaExpand, 
  FaExclamationTriangle,
  FaWifi
} from 'react-icons/fa'
import { ImSpinner8 } from 'react-icons/im'

interface OptimizedVideoPlayerProps {
  url: string
  width?: string
  height?: string
  cameraId?: string
  onError?: (error: any) => void
  autoplay?: boolean
  priority?: 'high' | 'normal' | 'low'
}

// Manager global para controlar a carga de streams
class StreamManager {
  private static instance: StreamManager
  private loadingStreams: Set<string> = new Set()
  private activeStreams: Set<string> = new Set()
  private maxConcurrentStreams = 4

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager()
    }
    return StreamManager.instance
  }

  canLoadStream(cameraId: string): boolean {
    return this.activeStreams.size < this.maxConcurrentStreams || this.activeStreams.has(cameraId)
  }

  registerStream(cameraId: string): void {
    this.activeStreams.add(cameraId)
    this.loadingStreams.delete(cameraId)
    console.log(`✅ Stream registrado: ${cameraId}. Total ativo: ${this.activeStreams.size}`)
  }

  unregisterStream(cameraId: string): void {
    this.activeStreams.delete(cameraId)
    this.loadingStreams.delete(cameraId)
    console.log(`❌ Stream removido: ${cameraId}. Total ativo: ${this.activeStreams.size}`)
  }

  startLoading(cameraId: string): void {
    this.loadingStreams.add(cameraId)
  }

  isLoading(cameraId: string): boolean {
    return this.loadingStreams.has(cameraId)
  }
}

export default function OptimizedVideoPlayer({ 
  url, 
  width = '100%', 
  height = '360px',
  cameraId = 'unknown',
  onError,
  autoplay = false,
  priority = 'normal'
}: OptimizedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true) // Começar mutado para evitar conflitos de áudio
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [canLoad, setCanLoad] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [errorDetails, setErrorDetails] = useState<any>(null)
  
  const playerRef = useRef<ReactPlayer>(null)
  const streamManager = StreamManager.getInstance()
  const containerRef = useRef<HTMLDivElement>(null)

  // Validar URL
  const isValidUrl = url && typeof url === 'string' && url.trim() !== ''

  // Gerenciar permissão de carregamento
  useEffect(() => {
    if (!isValidUrl || !cameraId) return

    const checkCanLoad = () => {
      const canLoadNow = streamManager.canLoadStream(cameraId)
      setCanLoad(canLoadNow)
      
      if (canLoadNow) {
        streamManager.startLoading(cameraId)
        setIsLoading(true)
        setHasError(false)
      }
    }

    checkCanLoad()

    // Verificar periodicamente se pode carregar
    const interval = setInterval(checkCanLoad, 2000)

    return () => {
      clearInterval(interval)
      if (cameraId) {
        streamManager.unregisterStream(cameraId)
      }
    }
  }, [url, cameraId, isValidUrl])

  // Resetar estado quando URL muda
  useEffect(() => {
    if (isValidUrl && canLoad) {
      setHasError(false)
      setIsLoading(true)
      setIsPlaying(autoplay)
      setErrorDetails(null)
    } else if (!isValidUrl) {
      setHasError(true)
      setIsLoading(false)
    }
  }, [url, isValidUrl, canLoad, autoplay])

  const handleReady = () => {
    console.log(`✅ Stream pronto: ${cameraId} - ${url}`)
    setIsLoading(false)
    setHasError(false)
    streamManager.registerStream(cameraId)
    
    if (autoplay) {
      setIsPlaying(true)
    }
  }

  const handleError = (error: any) => {
    console.error(`❌ Erro no stream ${cameraId}:`, error)
    setHasError(true)
    setIsLoading(false)
    setErrorDetails(error)
    streamManager.unregisterStream(cameraId)
    
    if (onError) {
      onError(error)
    }
  }

  const handleStart = () => {
    console.log(`▶️ Stream iniciado: ${cameraId}`)
    setIsPlaying(true)
  }

  const handlePause = () => {
    console.log(`⏸️ Stream pausado: ${cameraId}`)
    setIsPlaying(false)
  }

  const handleBuffer = () => {
    console.log(`⏳ Stream buffering: ${cameraId}`)
    setIsLoading(true)
  }

  const handleBufferEnd = () => {
    console.log(`✅ ReactPlayer buffer end: ${url}`)
    setIsLoading(false)
  }

  const retryConnection = () => {
    console.log(`🔄 Tentando reconectar stream: ${cameraId}`)
    setHasError(false)
    setIsLoading(true)
    setErrorDetails(null)
    
    if (playerRef.current) {
      const player = playerRef.current.getInternalPlayer()
      if (player && player.load) {
        player.load()
      }
    }
    
    // Re-registrar para tentar novamente
    streamManager.startLoading(cameraId)
  }

  const togglePlay = () => {
    if (!playerRef.current) return
    
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  if (!isValidUrl) {
    return (
      <div 
        className="relative bg-black rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center" 
        style={{ width, height }}
      >
        <div className="text-center">
          <FaExclamationTriangle className="text-red-400 text-3xl mx-auto mb-3" />
          <h3 className="text-white text-lg font-medium mb-2">URL Inválida</h3>
          <p className="text-gray-300 text-sm">A URL do vídeo não é válida</p>
        </div>
      </div>
    )
  }

  if (!canLoad) {
    return (
      <div 
        className="relative bg-black rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center" 
        style={{ width, height }}
      >
        <div className="text-center">
          <ImSpinner8 className="animate-spin text-blue-400 text-3xl mx-auto mb-3" />
          <h3 className="text-white text-lg font-medium mb-2">
            Aguardando na fila...
          </h3>
          <p className="text-gray-300 text-sm">
            Muitos streams ativos. Aguarde um momento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden border border-gray-300" 
      style={{ width, height }}
    >
      {/* Loading */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 rounded-lg">
          <div className="text-center">
            <ImSpinner8 className="animate-spin text-blue-400 text-3xl mx-auto mb-3" />
            <h3 className="text-white text-lg font-medium mb-2">
              Carregando stream...
            </h3>
            <p className="text-gray-300 text-sm">
              {cameraId ? `Câmera: ${cameraId.substring(0, 8)}...` : 'Conectando ao servidor'}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 rounded-lg">
          <div className="text-center">
            <FaExclamationTriangle className="text-red-400 text-3xl mx-auto mb-3" />
            <h3 className="text-white text-lg font-medium mb-2">
              Erro no Stream
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Falha ao carregar o stream HLS. Possível conflito de recursos.
            </p>
            <button
              onClick={retryConnection}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto"
            >
              <FaWifi className="mr-2" />
              Tentar Reconectar
            </button>
            {errorDetails && (
              <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
                <p className="text-red-200 text-xs">
                  💡 Erro: {JSON.stringify(errorDetails).substring(0, 100)}...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ReactPlayer */}
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={isPlaying}
        muted={isMuted}
        volume={volume}
        onReady={handleReady}
        onStart={handleStart}
        onPause={handlePause}
        onError={handleError}
        onBuffer={handleBuffer}
        onBufferEnd={handleBufferEnd}
        config={{
          file: {
            attributes: {
              crossOrigin: 'anonymous',
              playsInline: true,
              preload: 'metadata'
            }
          }
        }}
        style={{
          pointerEvents: hasError || isLoading ? 'none' : 'auto'
        }}
      />

      {/* Controles simplificados */}
      {!hasError && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePlay}
                className="text-white p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors text-sm"
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              
              <button
                onClick={toggleMute}
                className="text-white p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors text-sm"
                aria-label={isMuted ? 'Ativar Som' : 'Mudo'}
              >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="text-xs text-gray-300">
              {streamManager.isLoading(cameraId) ? '⏳' : '🔴'} {priority}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 