'use client'

import { useState, useEffect, useRef } from 'react'
import { FaCamera, FaWifi, FaPlay, FaRedo } from 'react-icons/fa'
import { ImSpinner8 } from 'react-icons/im'
import { useAuth } from '@/contexts/AuthContext'

interface RTSPPlayerProps {
  cameraId: string
  cameraName?: string
  width?: string
  height?: string
}

export default function RTSPPlayer({ 
  cameraId,
  cameraName = 'Câmera',
  width = '100%',
  height = '400px' 
}: RTSPPlayerProps) {
  const { session } = useAuth()
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

  const captureSnapshot = async () => {
    if (!session?.token) {
      setError('Token de autenticação não disponível')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const url = `${API_BASE_URL}/api/cameras/${cameraId}/snapshot`
      console.log('📸 Capturando snapshot via:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        // Criar uma URL blob para a imagem
        const imageBlob = await response.blob()
        const imageUrl = URL.createObjectURL(imageBlob)
        
        // Limpar URL anterior se existir
        if (snapshotUrl) {
          URL.revokeObjectURL(snapshotUrl)
        }
        
        setSnapshotUrl(imageUrl)
        setLastUpdate(new Date())
        setError(null)
        
        console.log('✅ Snapshot capturado com sucesso')
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`)
      }
      
    } catch (err: any) {
      console.warn('⚠️ Snapshot não disponível:', err.message || err)
      setError('Câmera temporariamente indisponível. Verifique se está online.')
    } finally {
      setLoading(false)
    }
  }

  const startAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    intervalRef.current = setInterval(() => {
      captureSnapshot()
    }, 5000) // Atualizar a cada 5 segundos
  }

  const stopAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    // Tentar capturar snapshot inicial
    if (session?.token) {
      captureSnapshot()
    }
    
    return () => {
      stopAutoRefresh()
      // Limpar URL do blob ao desmontar
      if (snapshotUrl) {
        URL.revokeObjectURL(snapshotUrl)
      }
    }
  }, [cameraId, session?.token])

  return (
    <div 
      className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300" 
      style={{ width, height }}
    >
      {/* Imagem de snapshot */}
      {snapshotUrl && !error ? (
        <div className="relative w-full h-full">
          <img
            src={snapshotUrl}
            alt={`Snapshot de ${cameraName}`}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay com informações */}
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-3 flex justify-between items-center">
            <div className="text-white text-sm">
              <span className="text-green-400">● </span>
              Snapshot: {lastUpdate?.toLocaleTimeString()}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={captureSnapshot}
                disabled={loading}
                className="text-white p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                title="Atualizar snapshot"
              >
                {loading ? (
                  <ImSpinner8 className="animate-spin text-sm" />
                ) : (
                  <FaRedo className="text-sm" />
                )}
              </button>
              
              <button
                onClick={intervalRef.current ? stopAutoRefresh : startAutoRefresh}
                className={`text-white px-2 py-1 rounded text-xs transition-colors ${
                  intervalRef.current 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {intervalRef.current ? 'Parar' : 'Auto'}
              </button>
            </div>
          </div>
        </div>
      ) : error ? (
        // Estado de erro
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center">
            <FaCamera className="text-gray-400 text-4xl mx-auto mb-3" />
            <h3 className="text-gray-700 font-semibold text-lg mb-2">
              Snapshot Indisponível
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {error}
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-800 text-xs">
                💡 Para visualização ao vivo contínua, use o botão "Iniciar Stream HLS" acima
              </p>
            </div>
            
            <button 
              onClick={captureSnapshot}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? (
                <>
                  <ImSpinner8 className="animate-spin mr-2" />
                  Tentando...
                </>
              ) : (
                <>
                  <FaPlay className="mr-2" />
                  Tentar Snapshot
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // Estado de carregamento inicial
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ImSpinner8 className="animate-spin text-blue-400 text-3xl mx-auto mb-3" />
            <h3 className="text-gray-700 text-lg font-medium mb-2">
              Conectando câmera...
            </h3>
            <p className="text-gray-600 text-sm">
              Capturando primeira imagem
            </p>
          </div>
        </div>
      )}
    </div>
  )
} 
