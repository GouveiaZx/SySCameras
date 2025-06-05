'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaExpand, 
  FaCompress, 
  FaExclamationTriangle,
  FaWifi
} from 'react-icons/fa'
import { ImSpinner8 } from 'react-icons/im'

interface VideoPlayerProps {
  url: string
  width?: string
  height?: string
  showControls?: boolean
  onSnapshot?: (dataUrl: string) => void
}

export default function VideoPlayer({ 
  url, 
  width = '100%', 
  height = '360px',
  showControls = true,
  onSnapshot
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [downloadUrl, setDownloadUrl] = useState<string>('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Validar URL
  const isValidUrl = url && typeof url === 'string' && url.trim() !== ''
  const isRtmpUrl = isValidUrl && url.toLowerCase().startsWith('rtmp://')

  // Resetar estado quando URL muda
  useEffect(() => {
    if (isValidUrl && !isRtmpUrl) {
      setHasError(false)
      setIsLoading(true)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      
      // Criar URL de download
      const downloadPath = url.replace('/api/recordings/stream/', '/api/recordings/download/')
      setDownloadUrl(downloadPath)
      
    } else if (isRtmpUrl) {
      // URLs RTMP não são suportadas diretamente no navegador
      setHasError(true)
      setIsLoading(false)
    } else {
      setHasError(true)
      setIsLoading(false)
    }
  }, [url, isValidUrl, isRtmpUrl])

  // Gerenciar fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Erro ao entrar em fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = e.currentTarget.error
    console.error('❌ Erro no vídeo:', error)
    console.error('❌ URL que falhou:', url)
    console.error('❌ Error code:', error?.code)
    console.error('❌ Error message:', error?.message)
    setHasError(true)
    setIsLoading(false)
  }

  const handleVideoLoad = () => {
    console.log('✅ Vídeo carregado:', url)
    setHasError(false)
    setIsLoading(false)
    
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(err => {
        console.error('Erro ao reproduzir:', err)
        setHasError(true)
      })
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const retryConnection = () => {
    console.log('🔄 Tentando reconectar para URL:', url)
    setHasError(false)
    setIsLoading(true)
    
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  const handleDownload = () => {
    console.log('📥 Iniciando download:', downloadUrl)
    window.open(downloadUrl, '_blank')
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!isValidUrl || isRtmpUrl) {
    return (
      <div 
        className={`relative bg-black rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} 
        style={{ width: isFullscreen ? '100%' : width, height: isFullscreen ? '100%' : height }}
      >
        <div className="text-center">
          <FaWifi className="text-yellow-400 text-3xl mx-auto mb-3" />
          <h3 className="text-white text-lg font-medium mb-2">
            {isRtmpUrl ? 'Stream RTMP Detectado' : 'URL Inválida'}
          </h3>
          <p className="text-gray-300 text-sm">
            {isRtmpUrl 
              ? 'URLs RTMP não são suportadas diretamente no navegador. Configure uma URL RTSP para esta câmera e use o Stream HLS.'
              : 'A URL do vídeo não é válida'
            }
          </p>
          {isRtmpUrl && (
            <p className="text-gray-400 text-xs mt-2">
              URL: {url}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden border border-gray-300 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} 
      style={{ width: isFullscreen ? '100%' : width, height: isFullscreen ? '100%' : height }}
    >
      {/* Loading */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 rounded-lg">
          <div className="text-center">
            <ImSpinner8 className="animate-spin text-blue-400 text-3xl mx-auto mb-3" />
            <h3 className="text-white text-lg font-medium mb-2">
              Carregando vídeo...
            </h3>
            <p className="text-gray-300 text-sm">
              Conectando ao servidor
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
              Arquivo Corrompido ou Incompatível
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              O arquivo de vídeo pode estar corrompido ou em formato incompatível com o navegador.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={retryConnection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto"
              >
                <FaWifi className="mr-2" />
                Tentar Reconectar
              </button>
              <button
                onClick={handleDownload}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center mx-auto"
              >
                📥 Baixar Arquivo
              </button>
            </div>
            <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
              <p className="text-red-200 text-xs">
                💡 Dica: Tente baixar e reproduzir em um player externo como VLC
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={url}
        onError={handleVideoError}
        onLoadedData={handleVideoLoad}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        controls={false}
      />

      {/* Controles customizados */}
      {showControls && !hasError && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-3">
          {/* Barra de progresso */}
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Controles */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePlay}
                className="text-white p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              
              <button
                onClick={toggleMute}
                className="text-white p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
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
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownload}
                className="text-white p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                aria-label="Download"
              >
                📥
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="text-white p-2 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                aria-label={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
