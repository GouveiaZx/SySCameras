'use client'

import { useState } from 'react'
import { FaCamera, FaWifi, FaPlay } from 'react-icons/fa'

interface RTMPFallbackProps {
  cameraName?: string
  onRetry?: () => void
  showRetry?: boolean
}

export default function RTMPFallback({ 
  cameraName = 'Câmera', 
  onRetry,
  showRetry = true 
}: RTMPFallbackProps) {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    if (!onRetry) return
    
    setIsRetrying(true)
    setTimeout(() => {
      onRetry()
      setIsRetrying(false)
    }, 1000)
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-8 text-center border border-gray-200">
      <div className="mb-4">
        <FaCamera className="text-gray-400 text-5xl mx-auto mb-3" />
        <h3 className="text-gray-700 font-semibold text-lg mb-2">
          {cameraName} Indisponível
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          O servidor de streaming RTMP não está acessível no momento.
        </p>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
        <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
          <FaWifi className="mr-2" />
          Status: Servidor Offline
        </div>
        <div className="text-xs text-gray-500">
          Verifique se o servidor RTMP está rodando na porta 1935
        </div>
      </div>

      {showRetry && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isRetrying ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Tentando...
            </>
          ) : (
            <>
              <FaPlay className="mr-2" />
              Tentar Novamente
            </>
          )}
        </button>
      )}

      <div className="mt-4 text-xs text-gray-400">
        💡 Para resolver: Inicie o servidor de streaming ou verifique a configuração da câmera
      </div>
    </div>
  )
} 
