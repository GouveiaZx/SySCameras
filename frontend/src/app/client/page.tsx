'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ImSpinner8 } from 'react-icons/im'
import { FiCamera, FiVideo, FiAlertCircle, FiEye } from 'react-icons/fi'
import StatusCards from '@/components/dashboard/StatusCards'
import toast from 'react-hot-toast'

// Tipo para StatusCards (mesmo usado no dashboard)
interface StatusCardStats {
  totalCameras: number;
  camerasOnline: number;
  camerasOffline: number;
  totalStorage: string;
  lastMotionDetection: string | null;
}

export default function ClientDashboard() {
  const router = useRouter()
  const { session, isClient } = useAuth()
  
  // Estado para StatusCards
  const [stats, setStats] = useState<StatusCardStats>({
    totalCameras: 0,
    camerasOnline: 0,
    camerasOffline: 0,
    totalStorage: '0 GB',
    lastMotionDetection: null
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const loadClientData = async () => {
      if (!session?.token) return
      
      // Verificar se o usuário é cliente
      if (!isClient) {
        router.push('/dashboard')
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        // Buscar dados do cliente
        const response = await fetch('/api/client/stats', {
          headers: {
            'Authorization': `Bearer ${session.token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Falha ao carregar dados do cliente')
        }
        
        const data = await response.json()
        
        // Atualizar estatísticas
        setStats({
          totalCameras: data.totalCameras,
          camerasOnline: data.camerasOnline,
          camerasOffline: data.totalCameras - data.camerasOnline,
          totalStorage: `${data.storageUsed.toFixed(1)} GB`,
          lastMotionDetection: data.lastMotionDetection
        })
      } catch (err) {
        console.error('Erro ao carregar dados do cliente:', err)
        setError('Falha ao carregar dados. Tente novamente.')
        toast.error('Falha ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    
    loadClientData()
  }, [session, isClient, router])
  
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Painel do Cliente</h1>
      
      {/* Status Cards */}
      <StatusCards stats={stats} />
      
      {/* Acesso rápido */}
      <h2 className="text-2xl font-semibold my-6">Acesso Rápido</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Câmeras */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Minhas Câmeras</h2>
              <p className="text-3xl font-bold mt-2">{stats.totalCameras}</p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.camerasOnline} online, {stats.camerasOffline} offline
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiCamera className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/client/cameras" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver câmeras →
            </Link>
          </div>
        </div>
        
        {/* Visualização ao vivo */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Visualização ao Vivo</h2>
              <p className="text-sm text-gray-500 mt-1">
                Acesse suas câmeras em tempo real
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FiEye className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/client/live" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver ao vivo →
            </Link>
          </div>
        </div>
        
        {/* Gravações */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Gravações</h2>
              <p className="text-sm text-gray-500 mt-1">
                Acesse as gravações das suas câmeras
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <FiVideo className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/client/recordings" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver gravações →
            </Link>
          </div>
        </div>
      </div>
      
      {/* Detecção de Movimento e Alertas */}
      <h2 className="text-2xl font-semibold my-6">Configurações</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Detecção de Movimento</h2>
              <p className="text-sm text-gray-500 mt-1">
                Visualize as configurações de detecção de movimento
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FiAlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/client/motion-detection" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver configurações →
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Alertas</h2>
              <p className="text-sm text-gray-500 mt-1">
                Visualize seus alertas configurados
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FiAlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/client/alerts" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver alertas →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 