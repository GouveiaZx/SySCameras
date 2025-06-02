'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import StatusCards from '@/components/dashboard/StatusCards'
import { FiCamera, FiVideo, FiHardDrive, FiAlertCircle } from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import { fetchCameras } from '@/services/cameraService'
import { fetchClients, fetchIntegrators, fetchDashboardStats } from '@/services/adminService'
import toast from 'react-hot-toast'

// Tipos para o dashboard (baseados em dados reais)
interface DashboardData {
  totalCameras: number;
  activeCameras: number;
  totalClients: number;
  totalIntegrators: number;
  totalRecordings: number;
  totalAlerts: {
    total: number;
    new: number;
    read: number;
  };
  storageUsed: {
    total: number;
    percentage: number;
  };
}

// Tipo para alertas recentes reais
interface Alert {
  id: string;
  type: 'motion' | 'offline' | 'storage';
  message: string;
  cameraName: string;
  date: string;
  readAt: string | null;
}

// Tipo para StatusCards (baseado em dados reais)
interface StatusCardStats {
  totalCameras: number;
  camerasOnline: number;
  camerasOffline: number;
  totalStorage: string;
  lastMotionDetection: string | null;
}

export default function Dashboard() {
  const { session, isAdmin, isIntegrator, isClient } = useAuth()
  
  // Estado para os dados do dashboard (todos reais)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalCameras: 0,
    activeCameras: 0,
    totalClients: 0,
    totalIntegrators: 0,
    totalRecordings: 0,
    totalAlerts: {
      total: 0,
      new: 0,
      read: 0
    },
    storageUsed: {
      total: 0,
      percentage: 0
    }
  })
  
  // Estado para StatusCards (baseado em dados reais)
  const [stats, setStats] = useState<StatusCardStats>({
    totalCameras: 0,
    camerasOnline: 0,
    camerasOffline: 0,
    totalStorage: '0 GB',
    lastMotionDetection: null
  })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  
  // Refs para controlar execução única
  const mountedRef = useRef(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
    }

    if (!session?.token || loadingRef.current) {
      return
    }

    const loadDashboardData = async () => {
      if (loadingRef.current) return
      
      try {
        loadingRef.current = true
        setLoading(true)
        setError(null)
        
        console.log('Carregando dados essenciais do dashboard...', new Date().toISOString())
        
        // Debug: Forçando reload para teste de autenticação - SUPABASE TEST
        
        // Buscar câmeras primeiro (mais rápido sem JOINs)
        const cameras = await fetchCameras(session.token)
        
        // Contar câmeras ativas de forma eficiente
        const activeCameras = cameras.filter(camera => camera.status === 'online')
        
        // Dados básicos sem consultas pesadas
        const basicData: DashboardData = {
          totalCameras: cameras.length,
          activeCameras: activeCameras.length,
          totalClients: 0, // Será carregado depois se necessário
          totalIntegrators: 0, // Será carregado depois se necessário
          totalRecordings: 0, // Será carregado depois se necessário
          totalAlerts: { total: 0, new: 0, read: 0 }, // Será carregado depois se necessário
          storageUsed: { total: 0, percentage: 0 } // Será carregado depois se necessário
        }
        
        setDashboardData(basicData)
        
        // Dados básicos para StatusCards
        setStats({
          totalCameras: cameras.length,
          camerasOnline: activeCameras.length,
          camerasOffline: cameras.length - activeCameras.length,
          totalStorage: '0 GB', // Será calculado depois
          lastMotionDetection: null
        })
        
        setLoading(false) // Liberar UI principal
        
        // Carregar dados pesados em background apenas para admin (verificar role do user atual)
        const currentUser = session.user;
        if (currentUser?.role === 'ADMIN') {
          console.log('Carregando dados administrativos...', new Date().toISOString())
          
          // Primeiro, testar a autenticação
          try {
            const { testAuthentication } = await import('@/services/adminService');
            await testAuthentication(session.token);
          } catch (testError) {
            console.error('❌ Teste de autenticação falhou:', testError);
          }
          
          try {
            // Usar Promise.allSettled para não falhar se uma consulta der erro
            const [clientsResult, dashboardStatsResult, integratorsResult] = await Promise.allSettled([
              fetchClients(session.token),
              fetchDashboardStats(session.token),
              fetchIntegrators(session.token)
            ])
            
            const clients = clientsResult.status === 'fulfilled' ? clientsResult.value : []
            const dashboardStats = dashboardStatsResult.status === 'fulfilled' ? dashboardStatsResult.value : null
            const integrators = integratorsResult.status === 'fulfilled' ? integratorsResult.value : []
            
            // Atualizar com dados completos
            const completeData: DashboardData = {
              ...basicData,
              totalClients: clients.length,
              totalIntegrators: integrators.length,
              totalRecordings: 0, // Não disponível ainda
              totalAlerts: dashboardStats?.totalAlerts || { total: 0, new: 0, read: 0 },
              storageUsed: { total: 0, percentage: 0 } // Não disponível ainda
            }
            
            setDashboardData(completeData)
            
            // Atualizar stats com storage
            setStats(prev => ({
              ...prev,
              totalStorage: `${(completeData.storageUsed.total / (1024 * 1024 * 1024)).toFixed(1)} GB`,
            }))
          } catch (adminError) {
            console.error('Erro ao carregar dados administrativos:', adminError)
          }
        }
        
        // Buscar alertas em background (não crítico)
        loadRecentAlerts().catch(console.error)
        
      } catch (err: any) {
        console.error('Erro ao carregar dados do dashboard:', err)
        
        // Se é erro de autenticação, tentar refrescar sessão
        if (err.message === 'AUTHENTICATION_ERROR') {
          console.log('Detectado erro de autenticação no dashboard')
          // Não fazer nada aqui, o SessionManager vai lidar
          return
        }
        
        setError('Falha ao carregar dados do dashboard. Tente novamente.')
        setLoading(false)
      } finally {
        loadingRef.current = false
      }
    }
    
    loadDashboardData()
  }, [session?.token]) // Removido Date.now() que estava causando loops

  // Função para carregar alertas reais
  const loadRecentAlerts = async () => {
    try {
      // Usar o Supabase diretamente para buscar alertas recentes
      const { data: alertsData, error } = await (await import('@/utils/supabase')).supabase
        .from('alerts')
        .select(`
          id,
          type,
          message,
          date,
          readAt,
          cameraId,
          cameras!inner (name)
        `)
        .order('date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Erro ao buscar alertas:', error)
        return
      }

      // Converter para o formato esperado
      const formattedAlerts: Alert[] = (alertsData || []).map((alert: any) => ({
        id: alert.id,
        type: alert.type as 'motion' | 'offline' | 'storage',
        message: alert.message,
        cameraName: alert.cameras?.name || 'Câmera desconhecida',
        date: alert.date,
        readAt: alert.readAt
      }))

      setRecentAlerts(formattedAlerts)
    } catch (error) {
      console.error('Erro ao carregar alertas:', error)
    }
  }

  // Formatar timestamp para exibição amigável
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) {
      return `Há ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60)
      return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`
    } else {
      const days = Math.floor(diffMins / 1440)
      return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`
    }
  }
  
  // Obter cor com base no tipo de alerta
  const getAlertColor = (type: string) => {
    switch (type) {
      case 'motion':
        return 'text-yellow-500'
      case 'offline':
        return 'text-red-500'
      case 'storage':
        return 'text-purple-500'
      default:
        return 'text-gray-500'
    }
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
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 force-dark-text">
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
    <div className="force-dark-text">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Painel de Controle</h1>
      
      {/* Status Cards com dados reais */}
      <StatusCards stats={stats} />
      
      {/* Cards com estatísticas reais específicos por perfil */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {(isAdmin || isIntegrator) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-700">Clientes</h2>
                <p className="text-3xl font-bold mt-2 text-gray-900">{dashboardData.totalClients}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isAdmin ? "Total no sistema" : "Sob sua gestão"}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <Link 
                href="/dashboard/clients" 
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Gerenciar clientes →
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Câmeras</h2>
              <p className="text-3xl font-bold mt-2 text-gray-900">{dashboardData.totalCameras}</p>
              <p className="text-sm text-gray-500 mt-1">{dashboardData.activeCameras} ativas</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiCamera className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/dashboard/cameras" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Gerenciar câmeras →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Gravações</h2>
              <p className="text-3xl font-bold mt-2 text-gray-900">{dashboardData.totalRecordings}</p>
              <p className="text-sm text-gray-500 mt-1">Total de gravações</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiVideo className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              href="/dashboard/recordings" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver gravações →
            </Link>
          </div>
        </div>
      </div>
      
      {/* Acesso rápido */}
      <h2 className="text-2xl font-semibold mb-4 text-gray-900">Acesso Rápido</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Link 
          href="/dashboard/cameras" 
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-6 rounded-lg shadow-lg transition-all duration-200 group border border-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Câmeras</h3>
              <p className="text-white font-semibold drop-shadow-lg opacity-100">Gerenciar câmeras</p>
            </div>
            <FiCamera className="text-2xl text-white group-hover:scale-110 transition-transform drop-shadow-lg" />
          </div>
        </Link>
        
        <Link 
          href="/stream-config" 
          className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 p-6 rounded-lg shadow-lg transition-all duration-200 group border border-indigo-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Config Stream</h3>
              <p className="text-white font-semibold drop-shadow-lg opacity-100">RTSP/RTMP</p>
            </div>
            <div className="text-2xl text-white group-hover:scale-110 transition-transform drop-shadow-lg">🎬</div>
          </div>
        </Link>
        
        <Link 
          href="/dashboard/live" 
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 p-6 rounded-lg shadow-lg transition-all duration-200 group border border-green-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Ao Vivo</h3>
              <p className="text-white font-semibold drop-shadow-lg opacity-100">Visualização em tempo real</p>
            </div>
            <div className="text-2xl text-white group-hover:scale-110 transition-transform drop-shadow-lg">📹</div>
          </div>
        </Link>
        
        <Link 
          href="/dashboard/recordings" 
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 p-6 rounded-lg shadow-lg transition-all duration-200 group border border-purple-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Gravações</h3>
              <p className="text-white font-semibold drop-shadow-lg opacity-100">Histórico de vídeos</p>
            </div>
            <FiVideo className="text-2xl text-white group-hover:scale-110 transition-transform drop-shadow-lg" />
          </div>
        </Link>
        
        <Link 
          href="/dashboard/alerts" 
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 p-6 rounded-lg shadow-lg transition-all duration-200 group border border-red-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Alertas</h3>
              <p className="text-white font-semibold drop-shadow-lg opacity-100">Eventos do sistema</p>
            </div>
            <FiAlertCircle className="text-2xl text-white group-hover:scale-110 transition-transform drop-shadow-lg" />
          </div>
        </Link>
      </div>
      
      {/* Grid com gráficos e alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Estatísticas de alertas reais */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Estatísticas de Alertas</h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{dashboardData.totalAlerts.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{dashboardData.totalAlerts.new}</p>
              <p className="text-sm text-gray-500">Novos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{dashboardData.totalAlerts.read}</p>
              <p className="text-sm text-gray-500">Lidos</p>
            </div>
          </div>
        </div>
        
        {/* Alertas recentes reais */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Alertas Recentes</h2>
          
          {recentAlerts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum alerta recente</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <FiAlertCircle className={`mt-1 ${getAlertColor(alert.type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500">{alert.cameraName}</p>
                    <p className="text-xs text-gray-400">{formatTimestamp(alert.date)}</p>
                  </div>
                  {!alert.readAt && (
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-4">
            <Link 
              href="/dashboard/alerts" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver todos os alertas →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 