'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaExclamationTriangle,
  FaWifi,
  FaCog
} from 'react-icons/fa'
import { ImSpinner8 } from 'react-icons/im'

interface StableVideoPlayerProps {
  url: string
  width?: string
  height?: string
  cameraId?: string
  onError?: (error: any) => void
  autoplay?: boolean
}

// Cache global para HLS.js
let hlsJs: any = null

export default function StableVideoPlayer({ 
  url, 
  width = '100%', 
  height = '360px',
  cameraId = 'unknown',
  onError,
  autoplay = false
}: StableVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volume, setVolume] = useState(0.5)
  const [hlsSupported, setHlsSupported] = useState(false)
  const [currentQuality, setCurrentQuality] = useState('medium')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [availableQualities, setAvailableQualities] = useState([
    { id: 'mobile', name: 'Móvel', description: 'Móvel (480x360, 8fps)' },
    { id: 'low', name: 'Baixa', description: 'Baixa (480x360, 8fps)' },
    { id: 'medium', name: 'Média', description: 'Média (640x480, 12fps)' },
    { id: 'high', name: 'Alta', description: 'Alta (720p, 15fps)' },
    { id: 'ultra', name: 'Ultra', description: 'Ultra (1080p, 20fps)' }
  ])
  const [playerKey, setPlayerKey] = useState(0) // Para forçar recriação do player
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout>()

  // Validar URL
  const isValidUrl = url && typeof url === 'string' && url.trim() !== ''
  const isHlsUrl = isValidUrl && url.includes('.m3u8')

  // Carregar HLS.js dinamicamente
  useEffect(() => {
    const loadHlsJs = async () => {
      try {
        if (!hlsJs) {
          const HLS = (await import('hls.js')).default
          hlsJs = HLS
        }
        setHlsSupported(hlsJs.isSupported())
      } catch (error) {
        console.error('Erro ao carregar HLS.js:', error)
        setHlsSupported(false)
      }
    }

    if (isHlsUrl) {
      loadHlsJs()
    } else {
      setHlsSupported(true) // Para URLs não-HLS
    }
  }, [isHlsUrl])

  // Carregar qualidades disponíveis
  useEffect(() => {
    const loadQualities = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/streams/qualities')
        const data = await response.json()
        
        if (data.success) {
          setAvailableQualities(data.data.qualities)
        }
      } catch (error) {
        console.warn('Não foi possível carregar qualidades:', error)
      }
    }

    loadQualities()
  }, [])

  // Setup do player
  useEffect(() => {
    if (!isValidUrl || !videoRef.current || !hlsSupported) return

    console.log(`🔧 Configurando player [key: ${playerKey}] para ${cameraId}...`)

    const video = videoRef.current
    setIsLoading(true)
    setHasError(false)

    const setupPlayer = () => {
      try {
        if (isHlsUrl && hlsJs && hlsJs.isSupported()) {
          // Usar HLS.js para streams HLS
          if (hlsRef.current) {
            hlsRef.current.destroy()
          }

          console.log(`📡 Criando instância HLS para ${cameraId}...`)

          const hls = new hlsJs({
            enableWorker: false,
            lowLatencyMode: false,
            backBufferLength: 30,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            startLevel: -1,
            capLevelToPlayerSize: true,
            debug: false,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            autoStartLoad: true,
            startPosition: -1,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 15000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 2000
          })

          hlsRef.current = hls

          hls.loadSource(url)
          hls.attachMedia(video)

          hls.on(hlsJs.Events.MANIFEST_PARSED, () => {
            console.log(`✅ HLS manifest carregado [key: ${playerKey}]: ${cameraId}`)
            setIsLoading(false)
            setHasError(false)
            
            // Detectar qualidade atual a partir da URL se possível
            const qualityMatch = url.match(/quality[_=](\w+)/i)
            if (qualityMatch) {
              setCurrentQuality(qualityMatch[1])
            }
            
            if (autoplay) {
              video.play().catch(err => {
                console.log('Autoplay bloqueado:', err)
              })
            }
          })

          hls.on(hlsJs.Events.ERROR, (event: any, data: any) => {
            console.error(`❌ Erro HLS ${cameraId} [key: ${playerKey}]:`, data)
            
            if (data.fatal) {
              switch (data.type) {
                case hlsJs.ErrorTypes.NETWORK_ERROR:
                  console.log(`🔄 Erro de rede fatal - tentando recuperar: ${cameraId}`)
                  // Para erros de manifestLoadError, recriar o player completamente
                  if (data.details === 'manifestLoadError') {
                    console.log(`🔄 Erro de manifest - recriando player em 3s...`)
                    setTimeout(() => {
                      console.log(`🔄 Recriando player para ${cameraId}...`)
                      setPlayerKey(prev => prev + 1)
                    }, 3000)
                  } else {
                    // Tentar recuperar normalmente
                    setTimeout(() => {
                      if (hlsRef.current) {
                        hlsRef.current.startLoad()
                      }
                    }, 1000)
                  }
                  break
                case hlsJs.ErrorTypes.MEDIA_ERROR:
                  console.log(`🔄 Erro de mídia fatal - tentando recuperar: ${cameraId}`)
                  // Tentar recuperar apenas uma vez
                  setTimeout(() => {
                    if (hlsRef.current) {
                      hlsRef.current.recoverMediaError()
                    }
                  }, 1000)
                  break
                default:
                  console.error(`❌ Erro fatal não recuperável: ${data.type}`)
                  setHasError(true)
                  setIsLoading(false)
                  break
              }
              
              if (onError) {
                onError(data)
              }
            } else {
              // Erros não-fatais - apenas log
              console.warn(`⚠️ Erro HLS não-fatal ${cameraId}:`, data.details)
            }
          })

        } else {
          // Fallback para vídeo nativo
          console.log(`📺 Usando vídeo nativo para ${cameraId}...`)
          video.src = url
          video.load()
        }

        // Event listeners do video
        const handleLoadStart = () => {
          setIsLoading(true)
        }

        const handleCanPlay = () => {
          setIsLoading(false)
          setHasError(false)
        }

        const handleError = (e: any) => {
          console.error(`❌ Erro no vídeo ${cameraId}:`, e)
          setHasError(true)
          setIsLoading(false)
          
          if (onError) {
            onError(e)
          }
        }

        const handlePlay = () => {
          setIsPlaying(true)
        }

        const handlePause = () => {
          setIsPlaying(false)
        }

        video.addEventListener('loadstart', handleLoadStart)
        video.addEventListener('canplay', handleCanPlay)
        video.addEventListener('error', handleError)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)

        return () => {
          video.removeEventListener('loadstart', handleLoadStart)
          video.removeEventListener('canplay', handleCanPlay)
          video.removeEventListener('error', handleError)
          video.removeEventListener('play', handlePlay)
          video.removeEventListener('pause', handlePause)
        }

      } catch (error) {
        console.error(`❌ Erro ao configurar player ${cameraId}:`, error)
        setHasError(true)
        setIsLoading(false)
      }
    }

    const cleanup = setupPlayer()

    return () => {
      if (cleanup) cleanup()
      
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [url, isValidUrl, hlsSupported, cameraId, autoplay, onError, isHlsUrl, playerKey])

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // Função para alterar qualidade
  const changeQuality = async (newQuality: string) => {
    if (!cameraId || cameraId === 'unknown') {
      console.warn('Não é possível alterar qualidade: cameraId não definido')
      return
    }

    try {
      console.log(`🎯 Alterando qualidade para: ${newQuality}`)
      setIsLoading(true)
      setShowQualityMenu(false)
      setHasError(false)
      
      // Verificar se o stream existe antes de tentar alterar qualidade
      const statusResponse = await fetch(`http://localhost:3002/api/streams/${cameraId}/status`)
      const statusData = await statusResponse.json()
      
      if (!statusData.success || statusData.data.status !== 'running') {
        console.warn(`⚠️ Stream não está ativo para câmera ${cameraId}, ignorando mudança de qualidade`)
        setIsLoading(false)
        return
      }
      
      // Destruir player atual primeiro
      if (hlsRef.current) {
        console.log('🔄 Destruindo player HLS atual...')
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      
      const response = await fetch(`http://localhost:3002/api/streams/${cameraId}/quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quality: newQuality })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Qualidade alterada no backend: ${data.message}`)
        setCurrentQuality(newQuality)
        
        // Aguardar 5 segundos para o stream se estabilizar e depois verificar se manifest existe
        console.log('⏳ Aguardando stream se estabilizar...')
        
        // Verificar se o manifest existe antes de recriar o player
        const checkManifest = async () => {
          try {
            const manifestResponse = await fetch(url, { method: 'HEAD' })
            if (manifestResponse.ok) {
              console.log('✅ Manifest disponível, recriando player...')
              setPlayerKey(prev => prev + 1)
              setIsLoading(false)
              setHasError(false)
            } else {
              console.log('⏳ Manifest ainda não disponível, aguardando mais...')
              setTimeout(checkManifest, 1000)
            }
          } catch (error) {
            console.log('⏳ Erro ao verificar manifest, tentando novamente...')
            setTimeout(checkManifest, 1000)
          }
        }
        
        setTimeout(checkManifest, 5000) // Aguardar 5s antes da primeira verificação
        
      } else {
        console.error('❌ Erro ao alterar qualidade no backend:', data.message)
        setIsLoading(false)
        setHasError(true)
      }
      
    } catch (error) {
      console.error('❌ Erro ao alterar qualidade:', error)
      setIsLoading(false)
      setHasError(true)
    }
  }

  const handleRetry = () => {
    console.log(`🔄 Tentando reconectar: ${cameraId}`)
    setHasError(false)
    setIsLoading(true)
    
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    
    // Incrementar playerKey para forçar recriação completa
    setPlayerKey(prev => prev + 1)
    
    // Aguardar menos tempo para reconexão
    retryTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
    }, 1500)
  }

  const togglePlay = async () => {
    if (!videoRef.current) return
    
    try {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        await videoRef.current.play()
      }
    } catch (error) {
      console.error('Erro ao controlar reprodução:', error)
    }
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
      setIsMuted(newVolume === 0)
    }
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
              Carregando...
            </h3>
            <p className="text-gray-300 text-sm">
              {cameraId ? `Câmera: ${cameraId.substring(0, 8)}...` : 'Conectando'}
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
              Stream Indisponível
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Falha ao carregar o stream da câmera.
            </p>
            <button
              onClick={handleRetry}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto"
            >
              <FaWifi className="mr-2" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={isMuted}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        style={{
          pointerEvents: hasError || isLoading ? 'none' : 'auto'
        }}
      />

      {/* Controles */}
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
            
            <div className="flex items-center space-x-2">
              {/* Controle de Qualidade */}
              {isHlsUrl && cameraId !== 'unknown' && (
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="text-white p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors text-sm flex items-center space-x-1"
                    title="Alterar Qualidade"
                  >
                    <FaCog />
                    <span className="text-xs">
                      {availableQualities.find(q => q.id === currentQuality)?.name || 'Média'}
                    </span>
                  </button>
                  
                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden min-w-48">
                      {availableQualities.map((quality) => (
                        <button
                          key={quality.id}
                          onClick={() => changeQuality(quality.id)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                            currentQuality === quality.id
                              ? 'text-blue-400 bg-gray-700'
                              : 'text-white'
                          }`}
                        >
                          <div className="font-medium">{quality.name}</div>
                          <div className="text-xs text-gray-400">{quality.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs text-gray-300">
                {isHlsUrl ? '🔴 HLS' : '📹 Direct'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 