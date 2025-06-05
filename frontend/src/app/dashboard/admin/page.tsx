'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { 
  fetchSystemStats, 
  fetchRecentActivities, 
  fetchRecordingsOverTime, 
  fetchAlertsOverTime,
  SystemStats,
  ActivityItem,
  StatsOverTime
} from '@/services/adminService'
import { 
  FiUsers, 
  FiUserCheck, 
  FiCamera, 
  FiVideo, 
  FiBell, 
  FiHardDrive,
  FiAlertTriangle,
  FiActivity,
  FiCalendar,
  FiClock
} from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts'
import Link from 'next/link'

export default function AdminDashboard() {
  const { session } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [recordingsData, setRecordingsData] = useState<StatsOverTime[]>([])
  const [alertsData, setAlertsData] = useState<StatsOverTime[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')

  // Verificar se o usuário é admin
  useEffect(() => {
    if (session && session.user && session.user.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, router])

  // Carregar dados do dashboard
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!session?.token) return

      try {
        setLoading(true)
        const [statsData, activitiesData, recordingsStats, alertsStats] = await Promise.all([
          fetchSystemStats(session.token),
          fetchRecentActivities(session.token, 10),
          fetchRecordingsOverTime(session.token, period),
          fetchAlertsOverTime(session.token, period)
        ])

        setStats(statsData)
        setActivities(activitiesData)
        setRecordingsData(recordingsStats)
        setAlertsData(alertsStats)
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [session, period])

  // Função para formatar bytes para exibição
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // Formatar data para atividades
  const formatActivityDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR })
  }

  // Obter ícone para o tipo de atividade
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ALERT':
        return <FiAlertTriangle className="text-yellow-500" />
      case 'CAMERA_ADDED':
        return <FiCamera className="text-blue-500" />
      case 'CLIENT_ADDED':
        return <FiUserCheck className="text-green-500" />
      case 'INTEGRATOR_ADDED':
        return <FiUsers className="text-purple-500" />
      case 'RECORDING':
        return <FiVideo className="text-red-500" />
      default:
        return <FiActivity className="text-gray-500" />
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard Administrativo</h1>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Integradores</p>
              <p className="text-2xl font-bold">{stats?.totalIntegrators || 0}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FiUsers className="text-blue-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Clientes</p>
              <p className="text-2xl font-bold">{stats?.totalClients || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <FiUserCheck className="text-green-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Câmeras</p>
              <p className="text-2xl font-bold">{stats?.totalCameras || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.activeCameras || 0} ativas
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <FiCamera className="text-red-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Gravações</p>
              <p className="text-2xl font-bold">{stats?.totalRecordings || 0}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <FiVideo className="text-purple-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Alertas</p>
              <p className="text-2xl font-bold">{stats?.totalAlerts.total || 0}</p>
              <p className="text-xs text-green-600 mt-1">
                {stats?.totalAlerts.new || 0} novos
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <FiBell className="text-yellow-600 text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 font-medium">Armazenamento</p>
              <p className="text-2xl font-bold">{stats ? formatBytes(stats.storageUsed.total) : '0 GB'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.storageUsed.percentage.toFixed(1) || 0}% utilizado
              </p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full">
              <FiHardDrive className="text-indigo-600 text-xl" />
            </div>
          </div>
          
          {/* Barra de progresso */}
          {stats && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full" 
                style={{ width: `${stats.storageUsed.percentage}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* Botões de ações principais */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link 
          href="/dashboard/admin/integrators" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Gerenciar Integradores
        </Link>
      </div>

      {/* Gráficos e atividades recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráficos */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Estatísticas</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => setPeriod('day')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Dia
              </button>
              <button 
                onClick={() => setPeriod('week')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Semana
              </button>
              <button 
                onClick={() => setPeriod('month')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Mês
              </button>
            </div>
          </div>
          
          {/* Gráfico de gravações */}
          <div className="mb-6">
            <h3 className="text-md font-medium mb-2">Gravações</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={recordingsData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} gravações`, 'Total']} />
                  <Bar dataKey="count" fill="#8884d8" name="Gravações" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Gráfico de alertas */}
          <div>
            <h3 className="text-md font-medium mb-2">Alertas</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={alertsData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} alertas`, 'Total']} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#ff7300" name="Alertas" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Atividades recentes */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-4">Atividades Recentes</h2>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <ImSpinner8 className="animate-spin text-blue-500 text-xl" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiActivity className="text-4xl mx-auto mb-2" />
              <p>Nenhuma atividade recente encontrada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-start">
                    <div className="p-2 mr-3">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{activity.type}</h3>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <FiClock className="mr-1" />
                        <span>{formatActivityDate(activity.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activities.length > 0 && (
            <div className="mt-4 text-center">
              <button className="text-blue-600 hover:text-blue-800 text-sm">
                Ver todas as atividades
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
