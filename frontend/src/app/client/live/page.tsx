'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { 
  fetchCameras,
  Camera, 
  startCameraStream, 
  stopCameraStream 
} from '@/services/cameraService'
import StableVideoPlayer from '@/components/player/StableVideoPlayer'
import { ImSpinner8 } from 'react-icons/im'
import { FiMaximize2, FiAlertCircle, FiPlay, FiRefreshCw } from 'react-icons/fi'
import { FaStop } from 'react-icons/fa'
import toast from 'react-hot-toast'

// Esta página é semelhante a /dashboard/live mas filtra apenas câmeras do cliente atual
export default function ClientLivePage() {
  const router = useRouter()
  const { session, isClient } = useAuth()
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullscreenCamera, setFullscreenCamera] = useState<Camera | null>(null)
  const [layout, setLayout] = useState<'2x2' | '3x3'>('2x2')
  const [streamingCameras, setStreamingCameras] = useState<Record<string, boolean>>({})
  const [processingCameras, setProcessingCameras] = useState<Record<string, boolean>>({})

  const loadCameras = async () => {
    if (!session?.token) return
    
    // Verificar se o usuário é cliente
    if (!isClient) {
      router.push('/dashboard')
      return
    }
    
    try {
      setLoading(true)
      // Usa um endpoint específico para clientes
      const camerasData = await fetchCameras(session.token)
      setCameras(camerasData)
      
      // Inicializar o estado de streaming para cada câmera
      const streamingStatus: Record<string, boolean> = {};
      camerasData.forEach(camera => {
        streamingStatus[camera.id] = camera.streamStatus === 'ACTIVE';
      });
      setStreamingCameras(streamingStatus);
    } catch (err) {
      console.error('Erro ao carregar câmeras:', err)
      setError('Falha ao carregar câmeras. Tente novamente.')
      toast.error('Falha ao carregar câmeras')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadCameras()
  }, [session, isClient, router])
  
  const handleFullscreen = (camera: Camera) => {
    setFullscreenCamera(camera)
  }
  
  const closeFullscreen = () => {
    setFullscreenCamera(null)
  }
  
  const toggleLayout = () => {
    setLayout(layout === '2x2' ? '3x3' : '2x2')
  }

  const startStream = async (cameraId: string) => {
    if (!session?.token) return
    
    try {
      // Marcar câmera como processando
      setProcessingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      const result = await startCameraStream(cameraId, session.token)
      
      // Atualizar a lista de câmeras com o novo URL HLS
      setCameras(prev => prev.map(camera => 
        camera.id === cameraId 
          ? { ...camera, hlsUrl: result.hlsUrl, streamStatus: 'ACTIVE' } 
          : camera
      ))
      
      // Atualizar estado de streaming
      setStreamingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      toast.success('Stream iniciado com sucesso')
    } catch (err) {
      console.error('Erro ao iniciar stream:', err)
      toast.error('Falha ao iniciar stream')
    } finally {
      // Remover estado de processamento
      setProcessingCameras(prev => ({ ...prev, [cameraId]: false }))
    }
  }

  const stopStream = async (cameraId: string) => {
    if (!session?.token) return
    
    try {
      // Marcar câmera como processando
      setProcessingCameras(prev => ({ ...prev, [cameraId]: true }))
      
      await stopCameraStream(cameraId, session.token)
      
      // Atualizar a lista de câmeras
      setCameras(prev => prev.map(camera => 
        camera.id === cameraId 
          ? { ...camera, hlsUrl: undefined, streamStatus: 'INACTIVE' } 
          : camera
      ))
      
      // Atualizar estado de streaming
      setStreamingCameras(prev => ({ ...prev, [cameraId]: false }))
      
      toast.success('Stream encerrado com sucesso')
    } catch (err) {
      console.error('Erro ao encerrar stream:', err)
      toast.error('Falha ao encerrar stream')
    } finally {
      // Remover estado de processamento
      setProcessingCameras(prev => ({ ...prev, [cameraId]: false }))
    }
  }

  const refreshCameras = () => {
    loadCameras()
    toast.success('Atualizando câmeras...')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded text-sm"
        >
          Tentar novamente
        </button>
      </div>
    )
  }
  
  if (cameras.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FiAlertCircle className="text-yellow-500 text-5xl mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Nenhuma câmera disponível</h2>
        <p className="text-gray-600 mb-4">
          Não foram encontradas câmeras para visualização ao vivo.
        </p>
      </div>
    )
  }
  
  if (fullscreenCamera) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex justify-between items-center p-4 bg-gray-900">
          <h2 className="text-white text-xl font-semibold">{fullscreenCamera.name}</h2>
          <div className="flex items-center space-x-3">
            {!streamingCameras[fullscreenCamera.id] ? (
              <button 
                onClick={() => startStream(fullscreenCamera.id)}
                disabled={processingCameras[fullscreenCamera.id]}
                className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded flex items-center"
              >
                {processingCameras[fullscreenCamera.id] ? (
                  <ImSpinner8 className="animate-spin mr-1" />
                ) : (
                  <FiPlay className="mr-1" />
                )}
                Iniciar Stream
              </button>
            ) : (
              <button 
                onClick={() => stopStream(fullscreenCamera.id)}
                disabled={processingCameras[fullscreenCamera.id]}
                className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded flex items-center"
              >
                {processingCameras[fullscreenCamera.id] ? (
                  <ImSpinner8 className="animate-spin mr-1" />
                ) : (
                  <FaStop className="mr-1" />
                )}
                Encerrar Stream
              </button>
            )}
            <button 
              onClick={closeFullscreen}
              className="text-white hover:text-gray-300"
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="flex-grow relative">
          <StableVideoPlayer 
            url={streamingCameras[fullscreenCamera.id] && fullscreenCamera.hlsUrl ? fullscreenCamera.hlsUrl : (fullscreenCamera.rtmpUrl || '')} 
            width="100%" 
            height="100%"
            cameraId={fullscreenCamera.id}
            autoplay={streamingCameras[fullscreenCamera.id]}
          />
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded">
            {fullscreenCamera.status === 'online' ? (
              <span className="text-green-500">● Online</span>
            ) : (
              <span className="text-red-500">● Offline</span>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // Determinar quantas câmeras exibir por linha e ajustar altura
  const gridCols = layout === '2x2' ? 'grid-cols-2' : 'grid-cols-3'
  const playerHeight = layout === '2x2' ? '300px' : '200px'
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Visualização ao Vivo</h1>
        <div className="flex space-x-3">
          <button
            onClick={refreshCameras}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center"
          >
            <FiRefreshCw className="mr-2" />
            Atualizar
          </button>
          <button
            onClick={toggleLayout}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Layout: {layout}
          </button>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-4`}>
        {cameras.map((camera) => (
          <div key={camera.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="relative">
              <StableVideoPlayer 
                url={streamingCameras[camera.id] && camera.hlsUrl ? camera.hlsUrl : (camera.rtmpUrl || '')} 
                height={playerHeight}
                width="100%"
                cameraId={camera.id}
                autoplay={streamingCameras[camera.id]}
              />
              <div className="absolute top-2 left-2 right-2 flex justify-between">
                <div>
                  {streamingCameras[camera.id] && (
                    <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                      HLS ATIVO
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleFullscreen(camera)}
                  className="bg-black bg-opacity-70 text-white p-1 rounded hover:bg-opacity-90"
                  title="Expandir"
                >
                  <FiMaximize2 />
                </button>
              </div>
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 text-xs rounded-full">
                {camera.status === 'online' ? (
                  <span className="text-green-500">● Online</span>
                ) : (
                  <span className="text-red-500">● Offline</span>
                )}
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-semibold truncate">{camera.name}</h3>
              <p className="text-sm text-gray-500 truncate">{camera.location || 'Sem localização'}</p>
              <div className="flex mt-2 space-x-2">
                {!streamingCameras[camera.id] ? (
                  <button 
                    onClick={() => startStream(camera.id)}
                    disabled={processingCameras[camera.id] || camera.status !== 'online'}
                    className={`text-xs px-2 py-1 rounded flex items-center ${
                      camera.status === 'online' 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
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
                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded flex items-center"
                  >
                    {processingCameras[camera.id] ? (
                      <ImSpinner8 className="animate-spin mr-1" />
                    ) : (
                      <FaStop className="mr-1" />
                    )}
                    Encerrar Stream
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 
