'use client'

import { useState } from 'react'
import { 
  FaVideo, 
  FaWifi, 
  FaPlay, 
  FaStop, 
  FaCog, 
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner
} from 'react-icons/fa'

export type StreamProtocol = 'rtsp' | 'rtmp'
export type StreamQuality = 'low' | 'medium' | 'high'

export interface StreamConfig {
  protocol: StreamProtocol
  url: string
  quality: StreamQuality
  cameraName: string
}

interface StreamConfigFormProps {
  onStartStream: (config: StreamConfig) => Promise<void>
  onStopStream: () => Promise<void>
  isStreaming: boolean
  isLoading: boolean
  streamUrl?: string
  error?: string
}

const qualityConfigs = {
  low: {
    name: 'Baixa',
    description: 'Ideal para conexões lentas',
    icon: '📱',
    resolution: '480x360',
    fps: '8fps',
    bitrate: '600k',
    color: 'blue'
  },
  medium: {
    name: 'Média', 
    description: 'Balanceado performance/qualidade',
    icon: '💻',
    resolution: '640x360',
    fps: '12fps', 
    bitrate: '1200k',
    color: 'green'
  },
  high: {
    name: 'Alta',
    description: 'Melhor qualidade, mais recursos',
    icon: '🖥️',
    resolution: '854x480',
    fps: '15fps',
    bitrate: '2000k',
    color: 'purple'
  }
}

export default function StreamConfigForm({
  onStartStream,
  onStopStream,
  isStreaming,
  isLoading,
  streamUrl,
  error
}: StreamConfigFormProps) {
  const [config, setConfig] = useState<StreamConfig>({
    protocol: 'rtsp',
    url: '',
    quality: 'medium',
    cameraName: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config.url.trim() || !config.cameraName.trim()) {
      return
    }
    await onStartStream(config)
  }

  const handleStop = async () => {
    await onStopStream()
  }

  const isValidUrl = (url: string, protocol: StreamProtocol) => {
    return url.toLowerCase().startsWith(`${protocol}://`)
  }

  const urlError = config.url && !isValidUrl(config.url, config.protocol)

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center space-x-3">
            <FaVideo className="text-2xl" />
            <div>
              <h2 className="text-2xl font-bold">Configuração de Stream</h2>
              <p className="text-blue-100">Configure sua câmera RTSP ou RTMP</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Nome da Câmera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Nome da Câmera
            </label>
            <input
              type="text"
              value={config.cameraName}
              onChange={(e) => setConfig(prev => ({ ...prev, cameraName: e.target.value }))}
              placeholder="Ex: Câmera Sala de Estar"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Seleção de Protocolo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Protocolo de Stream
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, protocol: 'rtsp', url: '' }))}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                  config.protocol === 'rtsp'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <FaWifi className="text-3xl text-blue-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-lg text-gray-800">RTSP</h3>
                    <p className="text-sm text-gray-600 mt-1">Real Time Streaming Protocol</p>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      Ideal para câmeras IP tradicionais e mais estável
                    </p>
                  </div>
                </div>
                
                {config.protocol === 'rtsp' && (
                  <div className="absolute top-4 right-4">
                    <FaCheckCircle className="text-blue-500 text-xl" />
                  </div>
                )}

                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  config.protocol === 'rtsp'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {config.protocol === 'rtsp' ? 'Selecionado' : 'Disponível'}
                </div>
              </button>

              <button
                type="button" 
                onClick={() => setConfig(prev => ({ ...prev, protocol: 'rtmp', url: '' }))}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                  config.protocol === 'rtmp'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <FaVideo className="text-3xl text-purple-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-lg text-gray-800">RTMP</h3>
                    <p className="text-sm text-gray-600 mt-1">Real Time Messaging Protocol</p>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      Protocolo moderno para streaming dinâmico
                    </p>
                  </div>
                </div>

                {config.protocol === 'rtmp' && (
                  <div className="absolute top-4 right-4">
                    <FaCheckCircle className="text-purple-500 text-xl" />
                  </div>
                )}

                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  config.protocol === 'rtmp'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {config.protocol === 'rtmp' ? 'Selecionado' : 'Disponível'}
                </div>
              </button>
            </div>
          </div>

          {/* URL da Câmera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              URL da Câmera
            </label>
            <div className="relative">
              <input
                type="url"
                value={config.url}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder={
                  config.protocol === 'rtsp' 
                    ? 'rtsp://admin:senha@192.168.1.100:554/stream1'
                    : 'rtmp://admin:senha@192.168.1.100/live/stream'
                }
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
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
              <p className="mt-2 text-sm text-red-600">
                URL deve começar com {config.protocol}://
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              {config.protocol === 'rtsp' 
                ? 'Formato: rtsp://usuario:senha@ip:porta/caminho'
                : 'Formato: rtmp://usuario:senha@ip:porta/aplicacao/stream'
              }
            </p>
          </div>

          {/* Seleção de Qualidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Qualidade do Stream
            </label>
            <div className="space-y-4">
              {Object.entries(qualityConfigs).map(([key, quality]) => {
                const isSelected = config.quality === key;
                
                // Classes de cor baseadas no tipo de qualidade
                const colorClasses = {
                  low: {
                    border: isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white',
                    text: isSelected ? 'text-blue-700' : 'text-gray-800',
                    badge: isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                    icon: 'text-blue-500'
                  },
                  medium: {
                    border: isSelected ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white',
                    text: isSelected ? 'text-green-700' : 'text-gray-800',
                    badge: isSelected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                    icon: 'text-green-500'
                  },
                  high: {
                    border: isSelected ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white',
                    text: isSelected ? 'text-purple-700' : 'text-gray-800',
                    badge: isSelected ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600',
                    icon: 'text-purple-500'
                  }
                }[key as StreamQuality];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, quality: key as StreamQuality }))}
                    className={`w-full relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${colorClasses.border}`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Lado Esquerdo - Ícone e Título */}
                      <div className="flex items-center space-x-4">
                        <span className="text-3xl">{quality.icon}</span>
                        <div>
                          <h3 className={`font-bold text-lg ${colorClasses.text}`}>
                            {quality.name}
                          </h3>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {quality.description}
                          </p>
                        </div>
                      </div>

                      {/* Centro - Especificações Técnicas */}
                      <div className="hidden md:flex items-center space-x-8">
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-500 block">Resolução</span>
                          <span className="text-sm font-mono text-gray-700">{quality.resolution}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-500 block">FPS</span>
                          <span className="text-sm font-mono text-gray-700">{quality.fps}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-500 block">Bitrate</span>
                          <span className="text-sm font-mono text-gray-700">{quality.bitrate}</span>
                        </div>
                      </div>

                      {/* Lado Direito - Status */}
                      <div className="flex items-center space-x-3">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
                          {isSelected ? 'Selecionada' : 'Disponível'}
                        </div>
                        {isSelected && (
                          <FaCheckCircle className={`${colorClasses.icon} text-xl`} />
                        )}
                      </div>
                    </div>

                    {/* Especificações para Mobile (abaixo do título) */}
                    <div className="md:hidden mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500 block">Resolução</span>
                        <span className="text-sm font-mono text-gray-700">{quality.resolution}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500 block">FPS</span>
                        <span className="text-sm font-mono text-gray-700">{quality.fps}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500 block">Bitrate</span>
                        <span className="text-sm font-mono text-gray-700">{quality.bitrate}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status e Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <FaExclamationTriangle className="text-red-500" />
                <span className="text-red-700 font-medium">Erro</span>
              </div>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          )}

          {streamUrl && isStreaming && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <FaCheckCircle className="text-green-500" />
                <span className="text-green-700 font-medium">Stream Ativo</span>
              </div>
              <p className="text-green-600 mt-1">Stream iniciado com sucesso!</p>
              <p className="text-xs text-green-500 mt-1 font-mono">{streamUrl}</p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
            {!isStreaming ? (
              <button
                type="submit"
                disabled={isLoading || urlError || !config.url.trim() || !config.cameraName.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin text-xl" />
                    <span>Iniciando Stream...</span>
                  </>
                ) : (
                  <>
                    <FaPlay className="text-xl" />
                    <span>Iniciar Stream</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                disabled={isLoading}
                className="flex-1 bg-red-600 text-white px-6 py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin text-xl" />
                    <span>Parando Stream...</span>
                  </>
                ) : (
                  <>
                    <FaStop className="text-xl" />
                    <span>Parar Stream</span>
                  </>
                )}
              </button>
            )}
            
            <button
              type="button"
              className="sm:w-auto px-6 py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-3 shadow-md hover:shadow-lg"
            >
              <FaCog className="text-xl" />
              <span>Avançado</span>
            </button>
          </div>
        </form>
      </div>

      {/* Dicas de Configuração */}
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <span>💡</span>
          <span>Dicas de Configuração</span>
        </h3>
        
        <div className="space-y-4 text-sm text-gray-600">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center space-x-2">
              <span>🎥</span>
              <span>RTSP (Recomendado)</span>
            </h4>
            <p className="text-blue-800 mb-2">Protocolo tradicional para câmeras IP. Mais estável e compatível.</p>
            <code className="block mt-2 text-xs bg-blue-100 p-2 rounded font-mono text-blue-900">
              rtsp://admin:senha@192.168.1.100:554/stream1
            </code>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center space-x-2">
              <span>📺</span>
              <span>RTMP</span>
            </h4>
            <p className="text-purple-800 mb-2">Protocolo moderno para streaming. Melhor para fontes dinâmicas.</p>
            <code className="block mt-2 text-xs bg-purple-100 p-2 rounded font-mono text-purple-900">
              rtmp://admin:senha@192.168.1.100/live/stream
            </code>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2 flex items-center space-x-2">
              <span>⚡</span>
              <span>Qualidade</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-yellow-800">
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
