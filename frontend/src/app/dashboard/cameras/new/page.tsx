'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createCamera } from '@/services/cameraService'
import { fetchClients, Client } from '@/services/clientService'
import { useAuth } from '@/contexts/AuthContext'
import { 
  FaVideo, 
  FaWifi, 
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa'

type StreamProtocol = 'rtsp' | 'rtmp'
type StreamQuality = 'low' | 'medium' | 'high'

const qualityConfigs = {
  low: {
    name: 'Baixa',
    description: '480x360, 8fps - Ideal para conexões lentas',
    icon: '📱',
    specs: 'Resolução: 480x360 | FPS: 8 | Bitrate: 600k'
  },
  medium: {
    name: 'Média', 
    description: '640x360, 12fps - Balanceado performance/qualidade',
    icon: '💻',
    specs: 'Resolução: 640x360 | FPS: 12 | Bitrate: 1200k'
  },
  high: {
    name: 'Alta',
    description: '854x480, 15fps - Melhor qualidade, mais recursos',
    icon: '🖥️',
    specs: 'Resolução: 854x480 | FPS: 15 | Bitrate: 2000k'
  }
}

export default function NewCameraPage() {
  const router = useRouter()
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [protocol, setProtocol] = useState<StreamProtocol>('rtsp')
  const [streamUrl, setStreamUrl] = useState('')
  const [quality, setQuality] = useState<StreamQuality>('medium')
  const [clientId, setClientId] = useState('')
  const [cameraType, setCameraType] = useState('generic')
  const [retentionDays, setRetentionDays] = useState(7)
  
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  
  // Carregar a lista de clientes
  useEffect(() => {
    const loadClients = async () => {
      try {
        if (session?.token) {
          const clientsData = await fetchClients(session.token)
          setClients(clientsData)
        }
      } catch (err) {
        console.error('Erro ao carregar clientes:', err)
      } finally {
        setLoadingClients(false)
      }
    }
    
    loadClients()
  }, [session])
  
  const isValidUrl = (url: string, protocol: StreamProtocol) => {
    return url.toLowerCase().startsWith(`${protocol}://`)
  }

  const urlError = streamUrl && !isValidUrl(streamUrl, protocol)
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (!session?.token) {
        throw new Error('Você precisa estar autenticado para adicionar câmeras')
      }
      
      // Preparar dados baseados no protocolo selecionado
      const cameraData: any = {
        name,
        clientId,
        type: cameraType as 'IP' | 'ANALOG',
        retentionDays
      };

      // Adicionar URL no campo correto baseado no protocolo
      if (protocol === 'rtsp') {
        cameraData.rtspUrl = streamUrl;
      } else if (protocol === 'rtmp') {
        cameraData.rtmpUrl = streamUrl;
      }
      
      await createCamera(cameraData, session.token)
      
      router.push('/dashboard/cameras')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao adicionar câmera'
      setError(errorMessage)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Adicionar Nova Câmera</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center space-x-3">
            <FaVideo className="text-2xl" />
            <div>
              <h2 className="text-xl font-bold">Configuração da Câmera</h2>
              <p className="text-blue-100">Configure sua câmera RTSP ou RTMP</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome da Câmera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Câmera
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Câmera Entrada Principal"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Seleção de Protocolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Protocolo de Stream
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setProtocol('rtsp')
                  setStreamUrl('')
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  protocol === 'rtsp'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FaWifi className="text-xl" />
                  <div className="text-left">
                    <div className="font-semibold">RTSP</div>
                    <div className="text-sm text-gray-500">Real Time Streaming Protocol</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Ideal para câmeras IP tradicionais
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button" 
                onClick={() => {
                  setProtocol('rtmp')
                  setStreamUrl('')
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  protocol === 'rtmp'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FaVideo className="text-xl" />
                  <div className="text-left">
                    <div className="font-semibold">RTMP</div>
                    <div className="text-sm text-gray-500">Real Time Messaging Protocol</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Ideal para streaming moderno
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* URL da Câmera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL da Câmera
            </label>
            <div className="relative">
              <input
                type="url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder={
                  protocol === 'rtsp' 
                    ? 'rtsp://admin:senha@192.168.1.100:554/stream1'
                    : 'rtmp://admin:senha@192.168.1.100/live/stream'
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${
                  urlError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              />
              {urlError && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <FaExclamationTriangle className="text-red-500" />
                </div>
              )}
            </div>
            {urlError && (
              <p className="mt-1 text-sm text-red-600">
                URL deve começar com {protocol}://
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {protocol === 'rtsp' 
                ? 'Formato: rtsp://usuario:senha@ip:porta/caminho'
                : 'Formato: rtmp://usuario:senha@ip:porta/aplicacao/stream'
              }
            </p>
          </div>

          {/* Seleção de Qualidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Qualidade do Stream
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(qualityConfigs).map(([key, qualityConfig]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQuality(key as StreamQuality)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    quality === key
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{qualityConfig.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{qualityConfig.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{qualityConfig.description}</div>
                      <div className="text-xs text-gray-500 mt-2 font-mono">
                        {qualityConfig.specs}
                      </div>
                    </div>
                    {quality === key && (
                      <FaCheckCircle className="text-green-500 mt-1" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Cliente */}
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <select
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loadingClients}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {loadingClients && (
              <p className="mt-1 text-sm text-gray-500">Carregando clientes...</p>
            )}
            {!loadingClients && clients.length === 0 && (
              <p className="mt-1 text-sm text-red-500">
                Nenhum cliente encontrado. Você precisa cadastrar um cliente primeiro.
              </p>
            )}
          </div>
          
          {/* Modelo da Câmera */}
          <div>
            <label htmlFor="cameraType" className="block text-sm font-medium text-gray-700 mb-2">
              Modelo da Câmera
            </label>
            <select
              id="cameraType"
              value={cameraType}
              onChange={(e) => setCameraType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="generic">Genérica</option>
              <option value="intelbras">Intelbras</option>
              <option value="hikvision">Hikvision</option>
              <option value="twg">TWG</option>
            </select>
          </div>
          
          {/* Dias de Retenção */}
          <div>
            <label htmlFor="retentionDays" className="block text-sm font-medium text-gray-700 mb-2">
              Dias de Retenção
            </label>
            <select
              id="retentionDays"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="1">1 dia</option>
              <option value="3">3 dias</option>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Período que as gravações serão mantidas antes da limpeza automática.
            </p>
          </div>
          
          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard/cameras')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all"
              disabled={loading || loadingClients || clients.length === 0 || urlError || !streamUrl.trim() || !name.trim()}
            >
              {loading ? 'Adicionando...' : 'Adicionar Câmera'}
            </button>
          </div>
        </form>
      </div>

      {/* Informações Adicionais */}
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💡 Dicas de Configuração
        </h3>
        
        <div className="space-y-4 text-sm text-gray-600">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">🎥 RTSP (Recomendado)</h4>
            <p>Protocolo tradicional para câmeras IP. Mais estável e compatível.</p>
            <code className="block mt-2 text-xs bg-blue-100 p-2 rounded">
              rtsp://admin:senha@192.168.1.100:554/stream1
            </code>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">📺 RTMP</h4>
            <p>Protocolo moderno para streaming. Melhor para fontes dinâmicas.</p>
            <code className="block mt-2 text-xs bg-purple-100 p-2 rounded">
              rtmp://admin:senha@192.168.1.100/live/stream
            </code>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">⚡ Qualidade</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Baixa:</strong> Para conexões lentas (600kbps, 8fps)</li>
              <li><strong>Média:</strong> Balanceado (1200kbps, 12fps)</li>
              <li><strong>Alta:</strong> Melhor qualidade (2000kbps, 15fps)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 