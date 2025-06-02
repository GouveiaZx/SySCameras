'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { 
  fetchCameraById, 
  deleteCamera,
  Camera
} from '@/services/cameraService'
import RTSPPlayer from '@/components/player/RTSPPlayer'
import StableVideoPlayer from '@/components/player/StableVideoPlayer'
import VideoPlayer from '@/components/player/VideoPlayer'
import RTMPFallback from '@/components/player/RTMPFallback'
import streamingService, { StreamStatus } from '@/services/streamingService'
import { FaExclamationTriangle } from 'react-icons/fa'

export default function CameraDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useAuth()
  const [camera, setCamera] = useState<Camera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)
  
  const cameraId = params.id as string
  
  useEffect(() => {
    const loadCamera = async () => {
      try {
        if (session?.token) {
          console.log('📷 Carregando dados da câmera:', cameraId);
          const cameraData = await fetchCameraById(cameraId, session.token)
          console.log('📷 Dados da câmera carregados:', cameraData);
          setCamera(cameraData)
          
          // Carregar status do stream após carregar a câmera
          console.log('🔍 Iniciando carregamento do status do stream...');
          await loadStreamStatus()
        }
      } catch (err) {
        setError('Falha ao carregar detalhes da câmera.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    if (cameraId && session?.token) {
      loadCamera()
    }
  }, [cameraId, session])

  const loadStreamStatus = async () => {
    if (!session?.token) return;
    
    try {
      console.log('🔍 Carregando status do stream para câmera:', cameraId);
      const response: any = await streamingService.getStreamStatus(cameraId);
      console.log('✅ Status do stream obtido:', response);
      
      // Verificar se a resposta tem o formato {success: true, data: {...}}
      if (response.success && response.data) {
        console.log('📊 Dados do stream extraídos:', response.data);
        setStreamStatus(response.data);
      } else if (response.active !== undefined) {
        // Formato direto do status
        console.log('📊 Status direto:', response);
        setStreamStatus(response);
      } else {
        throw new Error('Formato de resposta inesperado');
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar status do stream:', error);
      // Não definir erro se o stream simplesmente não existe
      const defaultStatus = {
        active: false,
        status: 'stopped'
      };
      console.log('🔄 Usando status padrão:', defaultStatus);
      setStreamStatus(defaultStatus);
    }
  };

  const handleToggleStream = async () => {
    if (!session?.token) return;
    
    setStreamLoading(true);
    try {
      console.log('🔄 Iniciando toggle do stream HLS...');
      const result = await streamingService.toggleHLSStream(cameraId, session.token, camera?.rtspUrl);
      
      if (result.success) {
        console.log('✅ Toggle realizado com sucesso:', result);
        
        // Aguardar um pouco para o backend processar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recarregar status do stream
        await loadStreamStatus();
        
        // Recarregar dados da câmera para atualizar hlsUrl
        console.log('🔄 Recarregando dados da câmera...');
        const updatedCamera = await fetchCameraById(cameraId, session.token);
        console.log('📷 Câmera atualizada:', updatedCamera);
        setCamera(updatedCamera);
        
        // Se o stream foi iniciado, forçar atualização da página após 2 segundos
        if (result.data?.streamInfo?.status === 'running') {
          console.log('🎬 Stream iniciado, atualizando interface...');
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao alternar stream:', error);
      setError(`Erro: ${error.message}`);
    } finally {
      setStreamLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!camera || !session?.token) return
    
    if (confirm('Tem certeza que deseja remover esta câmera? Esta ação não pode ser desfeita.')) {
      try {
        setDeleting(true)
        await deleteCamera(camera.id, session.token)
        router.push('/dashboard/cameras')
      } catch (err) {
        setError('Falha ao remover câmera. Tente novamente.')
        console.error(err)
        setDeleting(false)
      }
    }
  }

  // Função para determinar qual player usar
  const renderPlayer = () => {
    if (!camera) return null;
    
    // Debug: log do status atual
    console.log('🎯 Renderizando player:', { 
      hlsUrl: camera.hlsUrl, 
      streamActive: streamStatus?.active,
      streamStatus: streamStatus?.status,
      rtmpUrl: camera.rtmpUrl,
      rtspUrl: camera.rtspUrl 
    });
    
    // Se tem URL HLS ativa, usar StableVideoPlayer
    if (streamStatus?.active && camera.hlsUrl) {
      console.log('🎬 Usando StableVideoPlayer:', camera.hlsUrl);
      return (
        <StableVideoPlayer 
          url={camera.hlsUrl} 
          height="400px"
          width="100%"
          cameraId={camera.id}
          autoplay={true}
        />
      );
    }
    
    // Se tem RTMP, usar VideoPlayer
    if (camera.rtmpUrl) {
      console.log('📺 Usando VideoPlayer para RTMP:', camera.rtmpUrl);
      return (
        <VideoPlayer 
          url={camera.rtmpUrl} 
          height="400px" 
        />
      );
    }
    
    // Fallback para RTSP 
    if (camera.rtspUrl) {
      console.log('📷 Usando RTSPPlayer para RTSP:', camera.rtspUrl);
      return (
        <RTSPPlayer 
          cameraId={camera.id}
          cameraName={camera.name}
          height="400px"
        />
      );
    }
    
    console.log('❌ Nenhuma URL de stream disponível');
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-3" />
          <h3 className="text-gray-800 font-semibold text-lg mb-2">
            Stream Indisponível
            </h3>
            <p className="text-gray-600 text-sm">
            Nenhuma URL de transmissão configurada para esta câmera.
            </p>
        </div>
      </div>
    );
  };
  
  if (loading) return <div className="text-center py-10">Carregando detalhes da câmera...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>
  if (!camera) return <div className="text-center py-10">Câmera não encontrada</div>
  
  return (
    <div>
      <div className="flex items-center mb-6 space-x-4">
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-bold">{camera.name}</h1>
        <span 
          className={`px-3 py-1 rounded-full text-sm ${
            camera.status === 'online' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}
        >
          {camera.status === 'online' ? 'Online' : 'Offline'}
        </span>
        {streamStatus?.active && (
          <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
            🎬 Streaming HLS
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna do player */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Transmissão ao Vivo</h2>
              
              {/* Controles de Stream HLS */}
              {camera.rtspUrl && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleStream}
                    disabled={streamLoading}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      streamStatus?.active
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } disabled:bg-gray-400`}
                  >
                    {streamLoading ? (
                      '⏳ Processando...'
                    ) : streamStatus?.active ? (
                      '🛑 Parar Stream HLS'
                    ) : (
                      '🎬 Iniciar Stream HLS'
                    )}
                  </button>
                  
                  {streamStatus?.active && streamStatus.uptime && (
                    <span className="text-xs text-gray-500">
                      Ativo há {streamingService.formatUptime(streamStatus.uptime)}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {renderPlayer()}
            
            <div className="mt-4 text-sm text-gray-500">
              {camera.hlsUrl && streamStatus?.active ? (
                <>🎬 Stream HLS ativo. Transmissão em tempo real com baixa latência.</>
              ) : camera.rtmpUrl ? (
                <>A transmissão ao vivo pode demorar alguns segundos para iniciar. Se a câmera estiver offline, o vídeo não será exibido.</>
              ) : camera.rtspUrl ? (
                <>Exibindo snapshots da câmera RTSP. Clique em "Iniciar Stream HLS" para transmissão ao vivo contínua.</>
              ) : (
                <>Configure uma URL de stream para visualizar esta câmera ao vivo.</>
              )}
            </div>
          </div>
        </div>
        
        {/* Coluna de detalhes */}
        <div>
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-4">Detalhes da Câmera</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Modelo</p>
                <p className="text-gray-600">{camera.type}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <div className="flex items-center justify-between">
                  <span 
                    className={`px-2 py-1 rounded text-sm ${
                      camera.status === 'online' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {camera.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Status do Stream HLS */}
              {camera.rtspUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Stream HLS</p>
                  <div className="flex items-center justify-between">
                    <span 
                      className={`px-2 py-1 rounded text-sm ${
                        streamStatus?.active 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {streamStatus?.active ? `🎬 ${streamStatus.status}` : '⏹️ Parado'}
                    </span>
                    <button 
                      onClick={loadStreamStatus}
                      className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                    >
                      Atualizar
                    </button>
                  </div>
                  {streamStatus?.active && streamStatus.hlsUrl && (
                    <p className="text-xs text-gray-600 mt-1 break-all">
                      URL: {streamStatus.hlsUrl}
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-700">Retenção</p>
                <div className="flex items-center">
                  <p className="text-gray-600 mr-2">{camera.retention?.days || 7} dias</p>
                  <button 
                    onClick={() => router.push(`/dashboard/cameras/${camera.id}/retention`)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </button>
                </div>
              </div>
              
              {/* Cliente (se disponível) */}
              {camera.client && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Cliente</p>
                  <p className="text-gray-600">{camera.client.name}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-700">URL RTSP</p>
                <p className="text-sm text-gray-600 break-all">{camera.rtspUrl}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">URL RTMP</p>
                <p className="text-sm text-gray-600 break-all">{camera.rtmpUrl || 'Não configurado'}</p>
              </div>
              
              {camera.hlsUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700">URL HLS</p>
                  <p className="text-sm text-gray-600 break-all">{camera.hlsUrl}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Ações</h2>
            <div className="space-y-2">
              {camera.rtspUrl && (
                <button 
                  onClick={handleToggleStream}
                  disabled={streamLoading}
                  className={`w-full py-2 px-4 rounded text-white font-medium transition-colors ${
                    streamStatus?.active
                      ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                      : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                  }`}
                >
                  {streamLoading ? (
                    '⏳ Processando Stream...'
                  ) : streamStatus?.active ? (
                    '🛑 Parar Stream HLS'
                  ) : (
                    '🎬 Iniciar Stream HLS'
                  )}
                </button>
              )}
              <button 
                onClick={() => router.push(`/dashboard/cameras/${camera.id}/retention`)} 
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Configurar Retenção
              </button>
              <button 
                onClick={() => router.push(`/dashboard/cameras/${camera.id}/alerts`)} 
                className="w-full py-2 px-4 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Configurar Alertas
              </button>
              <button 
                onClick={() => router.push(`/dashboard/recordings?cameraId=${camera.id}`)} 
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver Gravações
              </button>
              <button 
                onClick={() => router.push(`/dashboard/cameras/${camera.id}/edit`)} 
                className="w-full py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Editar Câmera
              </button>
              <button 
                onClick={handleDelete} 
                className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={deleting}
              >
                {deleting ? 'Removendo...' : 'Remover Câmera'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 