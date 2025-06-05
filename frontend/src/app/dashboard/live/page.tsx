'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCameras, Camera, startCameraStream, stopCameraStream, deleteCamera } from '@/services/cameraService'
import VideoPlayer from '@/components/player/VideoPlayer'
import StableVideoPlayer from '@/components/player/StableVideoPlayer'
import { ImSpinner8 } from 'react-icons/im'
import { FiAlertCircle, FiPlay, FiRefreshCw, FiGrid, FiMonitor, FiTrash2 } from 'react-icons/fi'
import { FaStop } from 'react-icons/fa'
import toast from 'react-hot-toast'

export default function LivePage() {
  const { session } = useAuth()
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenCamera, setFullscreenCamera] = useState<Camera | null>(null)
  const [layout, setLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4'>('2x2')
  const [streamingCameras, setStreamingCameras] = useState<Record<string, boolean>>({})
  const [processingCameras, setProcessingCameras] = useState<Record<string, boolean>>({})
  const [deletingCameras, setDeletingCameras] = useState<Record<string, boolean>>({})
  
  const mountedRef = useRef(false)
  const loadingRef = useRef(false)

  const loadCameras = async () => {
    if (!session?.token || loadingRef.current) return
    
    try {
      loadingRef.current = true
      setLoading(true)
      setError(null)
      
      console.log('🎥 Carregando câmeras para visualização ao vivo...')
      
      const camerasData = await fetchCameras(session.token)
      setCameras(camerasData)
      
      // Inicializar o estado de streaming para cada câmera
      const streamingStatus: Record<string, boolean> = {};
      camerasData.forEach(camera => {
        streamingStatus[camera.id] = camera.streamStatus === 'ACTIVE';
      });
      setStreamingCameras(streamingStatus);
      
      console.log('✅ Câmeras carregadas para visualização:', camerasData.length)
    } catch (err: any) {
      console.error('❌ Erro ao carregar câmeras:', err)
      
      if (err.message === 'AUTHENTICATION_ERROR') {
        setError('Sua sessão expirou. Por favor, recarregue a página.')
      } else {
        setError('Falha ao carregar câmeras. Tente novamente.')
      }
      
      toast.error('Falha ao carregar câmeras')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
    }

    if (!session?.token) return

    loadCameras()
  }, [session?.token])
  
  const handleFullscreen = (camera: Camera) => {
    setFullscreenCamera(camera)
  }
  
  const closeFullscreen = () => {
    setFullscreenCamera(null)
  }
  
  const cycleLayout = () => {
    const layouts: Array<'1x1' | '2x2' | '3x3' | '4x4'> = ['1x1', '2x2', '3x3', '4x4']
    const currentIndex = layouts.indexOf(layout)
    const nextIndex = (currentIndex + 1) % layouts.length
    setLayout(layouts[nextIndex])
  }

  const startStream = async (cameraId: string) => {
    if (!session?.token) return
    
    try {
      setProcessingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      const result = await startCameraStream(cameraId, session.token)
      
      setCameras(prev => prev.map(camera => 
        camera.id === cameraId 
          ? { ...camera, hlsUrl: result.hlsUrl, streamStatus: 'ACTIVE' } 
          : camera
      ))
      
      setStreamingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      toast.success('Stream iniciado com sucesso')
    } catch (err) {
      console.error('Erro ao iniciar stream:', err)
      toast.error('Falha ao iniciar stream')
    } finally {
      setProcessingCameras(prev => ({ ...prev, [cameraId]: false }))
    }
  }

  const stopStream = async (cameraId: string) => {
    if (!session?.token) return
    
    try {
      setProcessingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      await stopCameraStream(cameraId, session.token)
      
      setCameras(prev => prev.map(camera => 
        camera.id === cameraId 
          ? { ...camera, hlsUrl: undefined, streamStatus: 'INACTIVE' } 
          : camera
      ))
      
      setStreamingCameras(prev => ({ ...prev, [cameraId]: false }))
      
      toast.success('Stream encerrado com sucesso')
    } catch (err) {
      console.error('Erro ao encerrar stream:', err)
      toast.error('Falha ao encerrar stream')
    } finally {
      setProcessingCameras(prev => ({ ...prev, [cameraId]: false }))
    }
  }

  const refreshCameras = () => {
    if (loadingRef.current) return
    loadCameras()
    toast.success('Atualizando câmeras...')
  }

  const deleteSelectedCamera = async (cameraId: string, cameraName: string) => {
    if (!session?.token) return
    
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir a câmera "${cameraName}"?\n\nEsta ação não pode ser desfeita.`
    )
    
    if (!confirmDelete) return
    
    try {
      setDeletingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      await deleteCamera(cameraId, session.token)
      
      // Remover câmera da lista local
      setCameras(prev => prev.filter(camera => camera.id !== cameraId))
      
      // Limpar estados relacionados
      setStreamingCameras(prev => {
        const newState = { ...prev }
        delete newState[cameraId]
        return newState
      })
      
      setProcessingCameras(prev => {
        const newState = { ...prev }
        delete newState[cameraId]
        return newState
      })
      
      toast.success(`Câmera "${cameraName}" excluída com sucesso`)
    } catch (err) {
      console.error('Erro ao excluir câmera:', err)
      toast.error('Falha ao excluir câmera')
    } finally {
      setDeletingCameras(prev => ({ ...prev, [cameraId]: false }))
    }
  }

  // Verificar se usuário pode excluir câmeras (apenas Admin e Integrador)
  const canDeleteCamera = session?.user?.role === 'ADMIN' || session?.user?.role === 'INTEGRATOR'

  // Configurações de layout responsivo
  const getLayoutConfig = () => {
    switch (layout) {
      case '1x1':
        return {
          gridCols: 'grid-cols-1',
          maxCameras: 1,
          playerHeight: 'h-96 md:h-[500px] lg:h-[600px]'
        }
      case '2x2':
        return {
          gridCols: 'grid-cols-1 md:grid-cols-2',
          maxCameras: 4,
          playerHeight: 'h-48 md:h-64 lg:h-80'
        }
      case '3x3':
        return {
          gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          maxCameras: 9,
          playerHeight: 'h-40 md:h-48 lg:h-56'
        }
      case '4x4':
        return {
          gridCols: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
          maxCameras: 16,
          playerHeight: 'h-32 md:h-40 lg:h-48'
        }
      default:
        return {
          gridCols: 'grid-cols-1 md:grid-cols-2',
          maxCameras: 4,
          playerHeight: 'h-48 md:h-64 lg:h-80'
        }
    }
  }

  if (loading) {
    return (
      <div className="force-dark-text">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visualização ao Vivo</h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <ImSpinner8 className="animate-spin text-blue-500 text-3xl mx-auto mb-4" />
          <p className="text-gray-600">Carregando câmeras...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="force-dark-text">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visualização ao Vivo</h1>
        </div>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p className="font-medium">{error}</p>
          <button 
            onClick={refreshCameras}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200"
            disabled={loading}
          >
            ⚠️ Tentar novamente
          </button>
        </div>
      </div>
    )
  }
  
  if (cameras.length === 0) {
    return (
      <div className="force-dark-text">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visualização ao Vivo</h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <FiAlertCircle className="text-yellow-500 text-5xl mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold mb-2 text-gray-900">Nenhuma câmera disponível</h2>
          <p className="text-gray-600 mb-4">
            Não foram encontradas câmeras para visualização ao vivo.
          </p>
          <button
            onClick={refreshCameras}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>
    )
  }
  
  // Modal fullscreen
  if (fullscreenCamera) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex justify-between items-center p-4 bg-gray-900">
          <h2 className="text-white text-lg md:text-xl font-semibold">{fullscreenCamera.name}</h2>
          <div className="flex items-center space-x-3">
            {!streamingCameras[fullscreenCamera.id] ? (
              <button 
                onClick={() => startStream(fullscreenCamera.id)}
                disabled={processingCameras[fullscreenCamera.id]}
                className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center font-semibold transition-colors duration-200"
              >
                {processingCameras[fullscreenCamera.id] ? (
                  <ImSpinner8 className="animate-spin mr-2" />
                ) : (
                  <FiPlay className="mr-2" />
                )}
                Iniciar Stream
              </button>
            ) : (
              <button 
                onClick={() => stopStream(fullscreenCamera.id)}
                disabled={processingCameras[fullscreenCamera.id]}
                className="text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center font-semibold transition-colors duration-200"
              >
                {processingCameras[fullscreenCamera.id] ? (
                  <ImSpinner8 className="animate-spin mr-2" />
                ) : (
                  <FaStop className="mr-2" />
                )}
                Encerrar Stream
              </button>
            )}
            {canDeleteCamera && (
              <button 
                onClick={() => {
                  closeFullscreen()
                  deleteSelectedCamera(fullscreenCamera.id, fullscreenCamera.name)
                }}
                disabled={deletingCameras[fullscreenCamera.id]}
                className="text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg flex items-center font-semibold transition-colors duration-200"
                title="Excluir câmera"
              >
                {deletingCameras[fullscreenCamera.id] ? (
                  <ImSpinner8 className="animate-spin mr-2" />
                ) : (
                  <FiTrash2 className="mr-2" />
                )}
                Excluir
              </button>
            )}
            <button 
              onClick={closeFullscreen}
              className="text-white hover:text-gray-300 font-semibold px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              ✕ Fechar
            </button>
          </div>
        </div>
        <div className="flex-grow relative">
          <StableVideoPlayer 
            url={streamingCameras[fullscreenCamera.id] && fullscreenCamera.hlsUrl ? fullscreenCamera.hlsUrl : (fullscreenCamera.rtmpUrl || '')} 
            width="100%" 
            height="100%"
            cameraId={fullscreenCamera.id}
            autoplay={true}
          />
          <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg">
            {fullscreenCamera.status === 'online' ? (
              <span className="text-green-400 font-semibold">● Online</span>
            ) : (
              <span className="text-red-400 font-semibold">● Offline</span>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  const layoutConfig = getLayoutConfig()
  const displayCameras = cameras.slice(0, layoutConfig.maxCameras)
  
  return (
    <div className="force-dark-text">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Visualização ao Vivo</h1>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={refreshCameras}
            className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 flex items-center"
            disabled={loading}
          >
            <FiRefreshCw className="mr-2" />
            Atualizar
          </button>
          <button
            onClick={cycleLayout}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 flex items-center"
          >
            <FiGrid className="mr-2" />
            Layout: {layout}
          </button>
        </div>
      </div>

      {/* Informações de layout */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <FiMonitor className="inline mr-1" />
          Exibindo {Math.min(cameras.length, layoutConfig.maxCameras)} de {cameras.length} câmeras disponíveis em layout {layout}
        </p>
      </div>

      <div className={`grid ${layoutConfig.gridCols} gap-4 md:gap-6`}>
        {displayCameras.map((camera) => (
          <div key={camera.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
            <div className="relative">
              <div className={layoutConfig.playerHeight}>
                <StableVideoPlayer 
                  url={streamingCameras[camera.id] && camera.hlsUrl ? camera.hlsUrl : (camera.rtmpUrl || '')} 
                  width="100%"
                  height="100%"
                  cameraId={camera.id}
                  autoplay={streamingCameras[camera.id]}
                />
              </div>
              
              {/* Overlay com controles */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                <div>
                  {streamingCameras[camera.id] && (
                    <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-sm">
                      HLS ATIVO
                    </span>
                  )}
                </div>
                <div>
                  {/* Status da câmera */}
                  <span className="bg-black bg-opacity-80 text-white px-2 py-1 text-xs font-semibold rounded-full">
                    {camera.status === 'online' ? (
                      <span className="text-green-400">● Online</span>
                    ) : (
                      <span className="text-red-400">● Offline</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Informações da câmera */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate text-sm md:text-base">{camera.name}</h3>
              {camera.client && (
                <p className="text-sm text-gray-500 truncate">{camera.client.name}</p>
              )}
              
              {/* Controles de stream */}
              <div className="flex mt-3 space-x-2">
                {!streamingCameras[camera.id] ? (
                  <button 
                    onClick={() => startStream(camera.id)}
                    disabled={processingCameras[camera.id] || camera.status !== 'online'}
                    className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center transition-all duration-200 ${
                      camera.status === 'online' 
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {processingCameras[camera.id] ? (
                      <ImSpinner8 className="animate-spin mr-1" />
                    ) : (
                      <FiPlay className="mr-1" />
                    )}
                    Iniciar Stream
                  </button>
                ) : (
                  <button 
                    onClick={() => stopStream(camera.id)}
                    disabled={processingCameras[camera.id]}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center shadow-sm transition-all duration-200"
                  >
                    {processingCameras[camera.id] ? (
                      <ImSpinner8 className="animate-spin mr-1" />
                    ) : (
                      <FaStop className="mr-1" />
                    )}
                    Encerrar Stream
                  </button>
                )}
                
                {/* Botão de exclusão apenas para Admin/Integrador */}
                {canDeleteCamera && (
                  <button 
                    onClick={() => deleteSelectedCamera(camera.id, camera.name)}
                    disabled={deletingCameras[camera.id]}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center shadow-sm transition-all duration-200"
                    title="Excluir câmera"
                  >
                    {deletingCameras[camera.id] ? (
                      <ImSpinner8 className="animate-spin mr-1" />
                    ) : (
                      <FiTrash2 className="mr-1" />
                    )}
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Mostrar aviso se há mais câmeras disponíveis */}
      {cameras.length > layoutConfig.maxCameras && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 Há {cameras.length - layoutConfig.maxCameras} câmeras adicionais. 
            Altere o layout para visualizar mais câmeras simultaneamente.
          </p>
        </div>
      )}
    </div>
  )
} 
