'use client'

import { useState } from 'react'
import StreamConfigForm, { StreamConfig } from '@/components/stream/StreamConfigForm'
import HLSPlayer from '@/components/player/HLSPlayer'
import streamingService from '@/services/streamingService'
import { FaTv, FaArrowLeft } from 'react-icons/fa'
import Link from 'next/link'

export default function StreamConfigPage() {
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null)
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartStream = async (config: StreamConfig) => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('🎬 Iniciando stream com configuração:', config)
      
      const result = await streamingService.startStream(config)
      
      if (result.success && result.data) {
        setCurrentStreamId(result.data.cameraId)
        setCurrentStreamUrl(result.data.hlsUrl)
        setIsStreaming(true)
        console.log('✅ Stream iniciado com sucesso:', result.data.hlsUrl)
      } else {
        throw new Error(result.message || 'Falha ao iniciar stream')
      }
      
    } catch (err: any) {
      console.error('❌ Erro ao iniciar stream:', err)
      setError(err.message || 'Erro desconhecido ao iniciar stream')
      setIsStreaming(false)
      setCurrentStreamId(null)
      setCurrentStreamUrl(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopStream = async () => {
    if (!currentStreamId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('🛑 Parando stream:', currentStreamId)
      
      await streamingService.stopStream(currentStreamId)
      
      setIsStreaming(false)
      setCurrentStreamId(null)
      setCurrentStreamUrl(null)
      console.log('✅ Stream parado com sucesso')
      
    } catch (err: any) {
      console.error('❌ Erro ao parar stream:', err)
      setError(err.message || 'Erro desconhecido ao parar stream')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </Link>
              <FaTv className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Configuração de Stream
                </h1>
                <p className="text-sm text-gray-500">
                  Configure e visualize streams RTSP/RTMP
                </p>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isStreaming 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isStreaming ? '🟢 Stream Ativo' : '⚫ Inativo'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário de Configuração */}
          <div className="order-2 lg:order-1">
            <StreamConfigForm
              onStartStream={handleStartStream}
              onStopStream={handleStopStream}
              isStreaming={isStreaming}
              isLoading={isLoading}
              streamUrl={currentStreamUrl || undefined}
              error={error || undefined}
            />

            {/* Informações do Sistema */}
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

          {/* Player de Preview */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden sticky top-8">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-white">
                <h3 className="text-lg font-semibold">Preview do Stream</h3>
                <p className="text-gray-300 text-sm">
                  {currentStreamUrl ? 'Stream ao vivo' : 'Configure uma câmera para ver o preview'}
                </p>
              </div>

              <div className="p-6">
                {currentStreamUrl ? (
                  <div className="space-y-4">
                    <HLSPlayer
                      url={currentStreamUrl}
                      showControls={true}
                      width="100%"
                      height="320px"
                    />
                    
                    {/* Informações do Stream */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">URL HLS:</span>
                        <code className="text-xs bg-gray-200 px-2 py-1 rounded max-w-xs truncate">
                          {currentStreamUrl}
                        </code>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">ID da Câmera:</span>
                        <span className="font-mono text-xs">{currentStreamId}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Status:</span>
                        <span className="text-green-600 font-medium">
                          🟢 Transmitindo
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <FaTv className="w-10 h-10 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum Stream Ativo
                    </h4>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      Configure uma câmera no formulário ao lado para iniciar o preview
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 