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
    <div className="max-w-4xl mx-auto p-6">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nome da Câmera */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Câmera
            </label>
            <input
              type="text"
              value={config.cameraName}
              onChange={(e) => setConfig(prev => ({ ...prev, cameraName: e.target.value }))}
              placeholder="Ex: Câmera Sala de Estar"
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
                onClick={() => setConfig(prev => ({ ...prev, protocol: 'rtsp', url: '' }))}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.protocol === 'rtsp'
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
                onClick={() => setConfig(prev => ({ ...prev, protocol: 'rtmp', url: '' }))}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.protocol === 'rtmp'
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
                value={config.url}
                onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder={
                  config.protocol === 'rtsp' 
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
                URL deve começar com {config.protocol}://
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {config.protocol === 'rtsp' 
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
              {Object.entries(qualityConfigs).map(([key, quality]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, quality: key as StreamQuality }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    config.quality === key
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{quality.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{quality.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{quality.description}</div>
                      <div className="text-xs text-gray-500 mt-2 font-mono">
                        {quality.specs}
                      </div>
                    </div>
                    {config.quality === key && (
                      <FaCheckCircle className="text-green-500 mt-1" />
                    )}
                  </div>
                </button>
              ))}
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
          <div className="flex space-x-4 pt-4">
            {!isStreaming ? (
              <button
                type="submit"
                disabled={isLoading || urlError || !config.url.trim() || !config.cameraName.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Iniciando Stream...</span>
                  </>
                ) : (
                  <>
                    <FaPlay />
                    <span>Iniciar Stream</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                disabled={isLoading}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-all flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Parando Stream...</span>
                  </>
                ) : (
                  <>
                    <FaStop />
                    <span>Parar Stream</span>
                  </>
                )}
              </button>
            )}
            
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all flex items-center space-x-2"
            >
              <FaCog />
              <span>Avançado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 