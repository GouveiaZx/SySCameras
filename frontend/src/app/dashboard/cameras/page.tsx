'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { fetchCameras, Camera, deleteCamera } from '@/services/cameraService'
import { useAuth } from '@/contexts/AuthContext'
import { FiTrash2 } from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import toast from 'react-hot-toast'

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingCameras, setDeletingCameras] = useState<Record<string, boolean>>({})
  const { session, isAuthenticated } = useAuth()
  const mountedRef = useRef(false)
  const loadingRef = useRef(false)

  // Usar apenas token como dependência e evitar múltiplas chamadas
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
    }

    if (!isAuthenticated || !session?.token || loadingRef.current) {
      return
    }

    const loadCameras = async () => {
      if (loadingRef.current) return
      
      try {
        loadingRef.current = true
        setLoading(true)
        setError(null)
        
        console.log('📹 Carregando câmeras...', new Date().toLocaleTimeString())
        
        const camerasData = await fetchCameras(session.token)
        setCameras(camerasData)
        console.log('✅ Câmeras carregadas:', camerasData.length)
        
      } catch (err: any) {
        // Se é erro de autenticação, simplesmente mostrar erro
        if (err.message === 'AUTHENTICATION_ERROR') {
          setError('Sua sessão expirou. Por favor, recarregue a página.')
        } else {
          setError('Falha ao carregar câmeras. Tente novamente.')
          console.error('❌ Erro ao carregar câmeras:', err)
        }
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadCameras()
  }, [session?.token, isAuthenticated])

  // Função para refresh manual (simplificada)
  const refreshCameras = async () => {
    if (!session?.token || loadingRef.current) return
    
    try {
      loadingRef.current = true
      setLoading(true)
      setError(null)
      
      console.log('🔄 Atualizando câmeras...')
      
      const camerasData = await fetchCameras(session.token)
      setCameras(camerasData)
      
    } catch (err: any) {
      if (err.message === 'AUTHENTICATION_ERROR') {
        setError('Sua sessão expirou. Por favor, recarregue a página.')
      } else {
        setError('Falha ao atualizar câmeras.')
        console.error(err)
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
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

  if (loading) {
    return (
      <div className="force-dark-text">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Câmeras</h1>
          <Link 
            href="/dashboard/cameras/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 border border-blue-500"
          >
            ➕ Nova Câmera
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando câmeras...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="force-dark-text">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Câmeras</h1>
          <Link 
            href="/dashboard/cameras/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 border border-blue-500"
          >
            ➕ Nova Câmera
          </Link>
        </div>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
          <button 
            onClick={refreshCameras}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 border border-red-500"
          >
            ⚠️ Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="force-dark-text">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Câmeras</h1>
        <div className="flex gap-3">
          <button
            onClick={refreshCameras}
            className="bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 border border-gray-600"
            title="Atualizar lista"
            disabled={loading}
          >
            🔄 Atualizar
          </button>
          <Link 
            href="/dashboard/cameras/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md transition-all duration-200 border border-blue-500"
          >
            ➕ Nova Câmera
          </Link>
        </div>
      </div>

      {cameras.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">Você ainda não possui câmeras cadastradas.</p>
          <Link 
            href="/dashboard/cameras/new" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 border border-blue-500"
          >
            ➕ Adicionar Câmera
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600">
            {cameras.length} câmera{cameras.length !== 1 ? 's' : ''} encontrada{cameras.length !== 1 ? 's' : ''}
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {cameras.map((camera) => (
              <div key={camera.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">{camera.name}</h2>
                    <span 
                      className={`px-3 py-1 rounded-full text-sm ${
                        camera.status === 'online' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {camera.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mt-2">{camera.type}</p>
                  
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm font-medium text-gray-900">URL RTSP</p>
                      <p className="text-sm text-gray-700 break-all">{camera.rtspUrl}</p>
                    </div>
                    
                    {camera.rtmpUrl && (
                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-sm font-medium text-gray-900">URL RTMP</p>
                        <p className="text-sm text-gray-700 break-all">{camera.rtmpUrl}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      {camera.rtmpUrl && (
                        <button
                          onClick={() => window.open(camera.rtmpUrl, '_blank')}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          Abrir RTMP
                        </button>
                      )}
                      <Link 
                        href={`/dashboard/cameras/${camera.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Ver transmissão ao vivo →
                      </Link>
                    </div>
                    
                    {/* Botão de exclusão apenas para Admin/Integrador */}
                    {canDeleteCamera && (
                      <button 
                        onClick={() => deleteSelectedCamera(camera.id, camera.name)}
                        disabled={deletingCameras[camera.id]}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-2 rounded-lg flex items-center shadow-sm transition-all duration-200"
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
        </>
      )}
    </div>
  )
} 
