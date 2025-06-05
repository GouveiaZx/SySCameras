'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { 
  FaPlay, 
  FaPause, 
  FaCheckCircle,
  FaExclamationTriangle,
  FaWifi,
  FaCamera,
  FaExpandArrowsAlt,
  FaCompressArrowsAlt
} from 'react-icons/fa'
import { ImSpinner8 } from 'react-icons/im'

// Carregar ReactPlayer dinamicamente sem SSR
const ReactPlayer = dynamic(() => import('react-player'), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-900 flex items-center justify-center h-full w-full rounded-lg">
      <div className="text-center">
        <ImSpinner8 className="animate-spin text-blue-400 text-3xl mx-auto mb-2" />
        <p className="text-gray-300 text-sm">Carregando player...</p>
      </div>
    </div>
  )
})

interface HLSPlayerProps {
  url: string
  width?: string
  height?: string
  showControls?: boolean
}

export default function HLSPlayer({ 
  url, 
  width = '100%', 
  height = '360px',
  showControls = true
}: HLSPlayerProps) {
  const [isClient, setIsClient] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [playerLoaded, setPlayerLoaded] = useState(false)
  const [streamType, setStreamType] = useState<'video' | 'snapshot' | null>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [imageSequence, setImageSequence] = useState(0)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [useNativeVideo, setUseNativeVideo] = useState(false)
  const [currentQuality, setCurrentQuality] = useState<string>('medium')
  const [availableQualities, setAvailableQualities] = useState<any[]>([])
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'reconnecting' | 'failed'>('connecting')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Validar URL
  const isValidUrl = url && typeof url === 'string' && url.trim() !== ''

  // Verificar se estamos no cliente
  useEffect(() => {
    setIsClient(true)
    
    // Buscar qualidades disponíveis
    fetchAvailableQualities()
  }, [])

  // Buscar qualidades disponíveis do worker
  const fetchAvailableQualities = async () => {
    try {
      const response = await fetch('/worker/api/streams/qualities')
      const data = await response.json()
      
      if (data.success) {
        setAvailableQualities(data.data.qualities)
        console.log('🎯 Qualidades disponíveis:', data.data.qualities)
      }
    } catch (error) {
      console.warn('⚠️ Erro ao buscar qualidades:', error)
    }
  }

  // Alterar qualidade do stream
  const changeQuality = async (newQuality: string) => {
    try {
      console.log(`🎯 Alterando qualidade para: ${newQuality}`)
      setConnectionStatus('reconnecting')
      
      // Extrair cameraId da URL
      const urlParts = url.split('/')
      const cameraId = urlParts[urlParts.length - 2] // penúltimo item
      
      const response = await fetch(`/worker/api/streams/${cameraId}/quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quality: newQuality })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCurrentQuality(newQuality)
        setConnectionStatus('connected')
        setShowQualityMenu(false)
        console.log(`✅ Qualidade alterada: ${data.message}`)
      } else {
        setConnectionStatus('failed')
        console.error('❌ Erro ao alterar qualidade:', data.message)
      }
      
    } catch (error) {
      setConnectionStatus('failed')
      console.error('❌ Erro ao alterar qualidade:', error)
    }
  }

  // Detectar tipo de stream ao carregar
  useEffect(() => {
    if (!isValidUrl) return

    const detectStreamType = async () => {
      try {
        console.log('🔍 Detectando tipo de stream:', url)
        setIsLoading(true)
        setHasError(false)
        
        // Usar GET diretamente em vez de HEAD
        const contentResponse = await fetch(url, { 
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        console.log('📡 Response status:', contentResponse.status, contentResponse.statusText)
        
        if (contentResponse.ok) {
          const content = await contentResponse.text()
          
          console.log('📄 Conteúdo m3u8:', content)
          console.log('📄 Primeiras 3 linhas:', content.split('\n').slice(0, 3))
          console.log('📄 Últimas 3 linhas:', content.split('\n').slice(-3))
          
          // Verificar se contém .ts (vídeo) primeiro, depois .jpg (snapshots)
          if (content.includes('.ts')) {
            console.log('🎥 Tipo detectado: video HLS (segmentos .ts encontrados)')
            console.log('🎥 URL completa para ReactPlayer:', url)
            setStreamType('video')
            setIsLoading(false)
            setHasError(false)
          } else if (content.includes('.jpg')) {
            console.log('📸 Tipo detectado: snapshot (apenas .jpg encontrado)')
            setStreamType('snapshot')
            setIsLoading(false)
            setHasError(false)
            
            // Iniciar modo snapshot imediatamente
            startSnapshotMode()
          } else {
            console.log('❓ Tipo não detectado, conteúdo:', content)
            console.log('📸 Tentando modo snapshot como fallback')
            setStreamType('snapshot')
            setIsLoading(false)
            setHasError(false)
            startSnapshotMode()
          }
        } else {
          console.error('❌ Erro HTTP:', contentResponse.status, contentResponse.statusText)
          throw new Error(`HTTP ${contentResponse.status}: ${contentResponse.statusText}`)
        }
        
      } catch (error: any) {
        console.error('❌ Erro ao detectar tipo de stream:', error)
        console.error('❌ Stack trace:', error.stack)
        setHasError(true)
        setIsLoading(false)
      }
    }

    // Delay inicial para evitar requisições muito rápidas
    const timeout = setTimeout(() => {
      detectStreamType()
    }, 500)

    return () => clearTimeout(timeout)
  }, [url, isValidUrl])

  // Iniciar modo snapshot
  const startSnapshotMode = () => {
    console.log('📸 Iniciando modo snapshot para URL:', url)
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    const updateSnapshot = async () => {
      try {
        console.log('🔄 Atualizando snapshot...')
        
        // Buscar arquivo m3u8 atualizado
        const response = await fetch(url, { 
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        console.log('📡 M3U8 response status:', response.status)
        
        if (response.ok) {
          const content = await response.text()
          console.log('📄 M3U8 content:', content)
          
          // Extrair último segmento
          const lines = content.split('\n').filter(line => line.trim())
          const lastSegment = lines[lines.length - 1]
          
          console.log('📸 Último segmento encontrado:', lastSegment)
          
          if (lastSegment && lastSegment.includes('.jpg')) {
            const baseUrl = url.replace('/stream.m3u8', '')
            const imageUrl = `${baseUrl}/${lastSegment}?t=${Date.now()}`
            
            console.log('📸 Atualizando snapshot:', imageUrl)
            console.log('📸 Estado atual - currentImage:', currentImage)
            console.log('📸 Estado atual - imageLoadFailed:', imageLoadFailed)
            
            // Resetar estado de falha quando nova imagem é definida
            setImageLoadFailed(false)
            setCurrentImage(imageUrl)
            setImageSequence(prev => {
              const newSeq = prev + 1
              console.log('📸 Novo imageSequence:', newSeq)
              return newSeq
            })
          } else {
            console.warn('⚠️ Nenhum segmento .jpg encontrado no último segmento:', lastSegment)
          }
        } else {
          console.warn('⚠️ Erro ao buscar m3u8:', response.status, response.statusText)
        }
      } catch (error) {
        console.warn('⚠️ Snapshot temporariamente indisponível:', error)
      }
    }
    
    // Primeira atualização imediata
    console.log('📸 Executando primeira atualização de snapshot...')
    updateSnapshot()
    
    // Atualizar a cada 3 segundos
    console.log('📸 Configurando interval para atualizações a cada 3 segundos')
    intervalRef.current = setInterval(updateSnapshot, 3000)
  }

  // Parar modo snapshot
  const stopSnapshotMode = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Gerenciar fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      stopSnapshotMode()
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

  const handleReady = () => {
    setHasError(false)
    setIsLoading(false)
    setPlayerLoaded(true)
    setConnectionStatus('connected')
  }

  const retryConnection = () => {
    setHasError(false)
    setIsLoading(true)
    setPlayerLoaded(false)
    setUseNativeVideo(false)
    setConnectionStatus('connecting')
    
    // Limpar cache do navegador para esta URL
    if ('caches' in window) {
      caches.delete('dynamic-cache')
    }
    
    // Reiniciar detecção de stream após delay
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  const tryNativeVideo = () => {
    console.log('🔄 Tentando player HTML5 nativo como fallback')
    setUseNativeVideo(true)
    setHasError(false)
    setIsLoading(false)
    setConnectionStatus('connecting')
  }

  const handleReactPlayerError = (error: any) => {
    console.error('❌ ReactPlayer error:', error, 'URL:', url)
    console.log('🔄 ReactPlayer falhou, tentando HTML5 nativo...')
    setConnectionStatus('reconnecting')
    tryNativeVideo()
  }

  const handleError = () => {
    console.error('❌ Erro no player de vídeo')
    setPlayerLoaded(false)
    setHasError(true)
    setIsLoading(false)
    setConnectionStatus('failed')
  }

  const testStreamDirectly = () => {
    console.log('🧪 Testando stream diretamente')
    setUseNativeVideo(true)
    setHasError(false)
    setIsLoading(false)
    
    if (videoRef.current) {
      const video = videoRef.current
      video.src = url
      video.load()
      video.play().catch(console.error)
    }
  }

  const togglePlayback = () => {
    if (streamType === 'snapshot') {
      if (intervalRef.current) {
        stopSnapshotMode()
        setIsPlaying(false)
      } else {
        startSnapshotMode()
        setIsPlaying(true)
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  // Não renderizar no servidor
  if (!isClient) return null

  // URL inválida
  if (!isValidUrl) {
    return (
      <div 
        className="relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-300" 
        style={{ width, height }}
      >
        <div className="text-center p-6">
          <FaExclamationTriangle className="text-orange-500 text-4xl mx-auto mb-3" />
          <h3 className="text-gray-800 font-semibold text-lg mb-2">
            Stream Indisponível
          </h3>
          <p className="text-gray-600 text-sm mb-3">
            A URL do stream não é válida ou está temporariamente indisponível.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-orange-800 text-xs">
              💡 Verifique se a câmera está conectada e configurada
            </p>
          </div>
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
              Conectando...
            </h3>
            <p className="text-gray-300 text-sm">
              Detectando tipo de stream
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
          <div className="text-center p-6">
            <FaWifi className="text-red-500 text-4xl mx-auto mb-3" />
            <h3 className="text-red-800 font-semibold text-lg mb-2">
              Falha na Conexão
            </h3>
            <p className="text-red-700 text-sm mb-4">
              Não foi possível carregar o stream de vídeo. Verifique se a câmera está online.
            </p>
            <button 
              onClick={retryConnection} 
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaWifi className="mr-2" />
              Tentar Reconnectar
            </button>
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          {/* Botão de tela cheia no canto superior direito */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 z-10 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-lg transition-all duration-200 shadow-sm"
            title={isFullscreen ? "Sair da tela cheia" : "Expandir para tela cheia"}
          >
            {isFullscreen ? <FaCompressArrowsAlt size={16} /> : <FaExpandArrowsAlt size={16} />}
          </button>
          
          {/* Player de vídeo HLS */}
          {streamType === 'video' && (
            <>
              {!useNativeVideo ? (
            <ReactPlayer
              url={url}
              playing={isPlaying}
              muted={false}
              width="100%"
              height="100%"
                  onError={handleReactPlayerError}
              onReady={() => {
                console.log('✅ ReactPlayer ready for URL:', url);
                handleReady();
              }}
              onBuffer={() => {
                console.log('📊 ReactPlayer buffering:', url);
                setIsLoading(true);
              }}
              onBufferEnd={() => {
                console.log('✅ ReactPlayer buffer end:', url);
                setIsLoading(false);
              }}
              controls={false}
              config={{
                file: {
                  forceVideo: true,
                  forceHLS: true,
                  hlsOptions: {
                    enableWorker: false,
                    enableSoftwareAES: true,
                    manifestLoadingTimeOut: 10000,
                    manifestLoadingMaxRetry: 6,
                    manifestLoadingRetryDelay: 500,
                    levelLoadingTimeOut: 10000,
                    levelLoadingMaxRetry: 6,
                    levelLoadingRetryDelay: 500,
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 6,
                    fragLoadingRetryDelay: 500,
                    startLevel: -1,
                    debug: true
                  },
                  attributes: {
                    controlsList: 'nodownload',
                    playsInline: true,
                    preload: 'auto',
                    crossOrigin: 'anonymous'
                  },
                },
              }}
            />
              ) : (
                <div className="h-full w-full relative">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    controls={showControls}
                    onError={(e) => {
                      console.error('❌ HTML5 video error:', e);
                      handleError();
                    }}
                    onLoadStart={() => {
                      console.log('📊 HTML5 video loading:', url);
                      setIsLoading(true);
                    }}
                    onCanPlay={() => {
                      console.log('✅ HTML5 video can play:', url);
                      setIsLoading(false);
                      setPlayerLoaded(true);
                    }}
                  >
                    <source src={url} type="application/x-mpegURL" />
                    Seu navegador não suporta reprodução de vídeo HLS.
                  </video>
                  
                  {/* Indicador de modo nativo */}
                  <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                    🎥 HTML5 Nativo
                  </div>
                </div>
              )}
            </>
          )}

          {/* Player de snapshots */}
          {streamType === 'snapshot' && (
            <div className="h-full w-full relative">
              {(() => {
                console.log('🎬 Renderizando snapshot player:', {
                  currentImage,
                  imageLoadFailed,
                  imageSequence,
                  streamType
                })
                
                if (currentImage && !imageLoadFailed) {
                  console.log('📸 Mostrando imagem:', currentImage)
                  return (
              <img
                key={imageSequence}
                src={currentImage}
                alt="Stream ao vivo"
                className="w-full h-full object-cover"
                onError={() => {
                        console.warn('⚠️ Snapshot temporariamente indisponível:', currentImage)
                        setImageLoadFailed(true)
                        
                        // Tentar novamente após 2 segundos
                        setTimeout(() => {
                          if (currentImage) {
                            console.log('🔄 Tentando recarregar snapshot:', currentImage)
                            setImageLoadFailed(false)
                          }
                        }, 2000)
                }}
                onLoad={() => {
                  console.log('✅ Snapshot carregado:', currentImage)
                        setImageLoadFailed(false)
                }}
              />
                  )
                } else {
                  console.log('🔄 Mostrando placeholder de inicialização')
                  return (
                    <div className="h-full w-full flex items-center justify-center bg-gray-100">
                      <div className="text-center p-6">
                        <FaCamera className="text-gray-400 text-4xl mx-auto mb-3" />
                        <h3 className="text-gray-700 font-semibold text-lg mb-2">
                          Stream Inicializando
                        </h3>
                        <p className="text-gray-600 text-sm mb-3">
                          Aguardando dados da câmera...
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-blue-800 text-xs">
                            💡 O stream está ativo, aguarde alguns segundos
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                }
              })()}
              
              {/* Indicador de modo snapshot */}
              <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                📸 Modo Snapshot
              </div>
              
              {/* Timestamp */}
              <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls overlay (sempre visível em tela cheia) */}
      {(showControls || isFullscreen) && !isLoading && !hasError && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black bg-opacity-50 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-3">
            <button
              onClick={togglePlayback}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
            </button>
            
            {streamType === 'video' && !useNativeVideo && (
              <button 
                onClick={tryNativeVideo}
                className="text-white hover:text-green-400 transition-colors text-sm bg-blue-600 px-2 py-1 rounded"
                title="Tentar player HTML5 nativo"
              >
                🎥 HTML5
              </button>
            )}

            {/* 🆕 Seletor de Qualidade */}
            {streamType === 'video' && availableQualities.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="text-white hover:text-yellow-400 transition-colors text-sm bg-gray-600 px-2 py-1 rounded flex items-center"
                  title="Alterar qualidade"
                >
                  🎯 {availableQualities.find(q => q.id === currentQuality)?.name || 'Média'}
                  <span className="ml-1">▼</span>
                </button>
                
                {showQualityMenu && (
                  <div className="absolute bottom-full mb-2 left-0 bg-black bg-opacity-90 rounded-lg shadow-lg py-2 min-w-[150px] z-50">
                    {availableQualities.map((quality) => (
                      <button
                        key={quality.id}
                        onClick={() => changeQuality(quality.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                          currentQuality === quality.id 
                            ? 'text-yellow-400 bg-gray-800' 
                            : 'text-white'
                        }`}
                        disabled={connectionStatus === 'reconnecting'}
                      >
                        <div className="font-medium">{quality.name}</div>
                        <div className="text-xs text-gray-400">{quality.description}</div>
                      </button>
                    ))}
                  </div>
              )}
            </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 🆕 Status de Conexão */}
            <div className="flex items-center text-white text-sm">
              {connectionStatus === 'connected' && <FaCheckCircle className="text-green-400 inline mr-1" />}
              {connectionStatus === 'connecting' && <ImSpinner8 className="animate-spin text-blue-400 inline mr-1" />}
              {connectionStatus === 'reconnecting' && <ImSpinner8 className="animate-spin text-yellow-400 inline mr-1" />}
              {connectionStatus === 'failed' && <FaExclamationTriangle className="text-red-400 inline mr-1" />}
              
              <span className="capitalize">
                {connectionStatus === 'connected' && (streamType === 'video' ? (useNativeVideo ? 'HTML5' : 'ReactPlayer') : 'Snapshot')}
                {connectionStatus === 'connecting' && 'Conectando'}
                {connectionStatus === 'reconnecting' && 'Reconectando'}
                {connectionStatus === 'failed' && 'Falha'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
