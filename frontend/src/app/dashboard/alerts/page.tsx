'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchAlerts, markAlertAsRead, deleteAlert, Alert, AlertFilters } from '@/services/alertService'
import { fetchCameras, Camera } from '@/services/cameraService'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FiCalendar, FiEye, FiAlertTriangle, FiTrash2, FiCamera, FiCheck, FiImage } from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Image from 'next/image'

export default function AlertsPage() {
  const { session } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [filters, setFilters] = useState<AlertFilters>({
    cameraId: undefined,
    startDate: undefined,
    endDate: undefined,
    status: undefined,
    type: undefined,
    page: 1,
    limit: 20
  })
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadCameras = async () => {
    if (!session?.token) return
    
    try {
      const camerasData = await fetchCameras(session.token)
      setCameras(camerasData)
    } catch (error) {
      console.error('Erro ao carregar câmeras:', error)
      toast.error('Falha ao carregar câmeras')
    }
  }

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      
      const alertFilters: AlertFilters = {
        ...filters,
        page: page,
        limit: 20
      };
      
      // Usar token se disponível
      const result = await fetchAlerts(alertFilters, session?.token);
      
      if (result.data && Array.isArray(result.data)) {
        setAlerts(result.data);
        setTotalPages(result.meta?.totalPages || 0);
        setTotalCount(result.meta?.total || 0);
      } else {
        // Se não há dados, mostrar lista vazia silenciosamente
        console.log('Nenhum alerta encontrado ou serviço indisponível');
        setAlerts([]);
        setTotalPages(0);
        setTotalCount(0);
      }
    } catch (error: any) {
      // Apenas logar warnings em vez de errors para não poluir o console
      console.warn('Serviço de alertas temporariamente indisponível:', error.message);
      
      // Mostrar dados vazios em vez de erro
      setAlerts([]);
      setTotalPages(0);
      setTotalCount(0);
      
      // Não mostrar toast de erro para evitar spam de notificações
      // toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCameras()
  }, [session])

  useEffect(() => {
    loadAlerts()
  }, [filters, session])

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilters({
      ...filters,
      cameraId: value === 'all' ? undefined : value,
      page: 1
    })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilters({
      ...filters,
      status: value === 'all' ? undefined : value,
      page: 1
    })
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFilters({
      ...filters,
      type: value === 'all' ? undefined : value,
      page: 1
    })
  }

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFilters({
      ...filters,
      [name]: value,
      page: 1
    })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    
    setFilters({
      ...filters,
      page: newPage
    })
  }

  const handleViewAlert = async (alert: Alert) => {
    if (!session?.token) return
    
    setSelectedAlert(alert)
    
    // Se o alerta estiver com status NEW, marcar como lido
    if (alert.status === 'NEW') {
      try {
        const updatedAlert = await markAlertAsRead(alert.id, session.token)
        
        // Atualizar o alerta na lista
        setAlerts(prev => prev.map(a => 
          a.id === updatedAlert.id ? updatedAlert : a
        ))
        
        // Atualizar o alerta selecionado
        setSelectedAlert(updatedAlert)
      } catch (error) {
        console.error('Erro ao marcar alerta como lido:', error)
      }
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    if (!session?.token) return
    
    if (!confirm('Tem certeza que deseja excluir este alerta?')) {
      return
    }
    
    try {
      await deleteAlert(alertId, session.token)
      
      // Remover alerta da lista
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      
      // Se o alerta excluído for o selecionado, limpar seleção
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null)
      }
      
      toast.success('Alerta excluído com sucesso')
    } catch (error) {
      console.error('Erro ao excluir alerta:', error)
      toast.error('Falha ao excluir alerta')
    }
  }

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })
  }

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'MOTION':
        return 'Movimento'
      case 'OFFLINE':
        return 'Câmera Offline'
      case 'MANUAL':
        return 'Manual'
      default:
        return type
    }
  }

  const getAlertStatusLabel = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'Novo'
      case 'READ':
        return 'Lido'
      case 'DISMISSED':
        return 'Descartado'
      default:
        return status
    }
  }

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'MOTION':
        return 'bg-yellow-100 text-yellow-800'
      case 'OFFLINE':
        return 'bg-red-100 text-red-800'
      case 'MANUAL':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAlertStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-green-100 text-green-800'
      case 'READ':
        return 'bg-gray-100 text-gray-800'
      case 'DISMISSED':
        return 'bg-gray-200 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && alerts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Alertas</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between mb-6 gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Câmera</label>
            <select
              value={filters.cameraId || 'all'}
              onChange={handleCameraChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todas as câmeras</option>
              {cameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} {camera.client ? `(${camera.client.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
            <div className="relative">
              <input
                type="date"
                name="startDate"
                value={filters.startDate || ''}
                onChange={handleDateFilterChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <FiCalendar className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
            <div className="relative">
              <input
                type="date"
                name="endDate"
                value={filters.endDate || ''}
                onChange={handleDateFilterChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              <FiCalendar className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status || 'all'}
              onChange={handleStatusChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              <option value="NEW">Novos</option>
              <option value="READ">Lidos</option>
              <option value="DISMISSED">Descartados</option>
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filters.type || 'all'}
              onChange={handleTypeChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              <option value="MOTION">Movimento</option>
              <option value="OFFLINE">Câmera Offline</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white rounded-lg shadow-md p-4 h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Lista de Alertas</h2>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiAlertTriangle className="text-4xl mx-auto mb-2" />
              <p>Nenhum alerta encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`p-3 border rounded-md cursor-pointer transition ${
                      selectedAlert?.id === alert.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : alert.status === 'NEW' 
                          ? 'border-green-500 bg-green-50 hover:bg-green-100' 
                          : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleViewAlert(alert)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{alert.camera?.name || 'Câmera desconhecida'}</div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <FiCalendar className="mr-1" />
                          {format(parseISO(alert.date), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-xs px-2 py-1 rounded-full mb-1 ${getAlertTypeColor(alert.type)}`}>
                          {getAlertTypeLabel(alert.type)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getAlertStatusColor(alert.status)}`}>
                          {getAlertStatusLabel(alert.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Paginação */}
              <div className="flex justify-center items-center mt-6">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className={`px-3 py-1 rounded-md ${
                    page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Anterior
                </button>
                <span className="mx-4 text-sm">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className={`px-3 py-1 rounded-md ${
                    page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Próxima
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="md:col-span-2 bg-white rounded-lg shadow-md p-4 h-[600px]">
          {selectedAlert ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Detalhes do Alerta</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDeleteAlert(selectedAlert.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center text-sm"
                  >
                    <FiTrash2 className="mr-1" />
                    Excluir
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Câmera</h3>
                  <p className="text-sm flex items-center">
                    <FiCamera className="mr-1" />
                    {selectedAlert.camera?.name || 'Câmera desconhecida'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Data e Hora</h3>
                  <p className="text-sm">{formatDate(selectedAlert.date)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Tipo</h3>
                  <p className="text-sm">
                    <span className={`px-2 py-0.5 rounded-full ${getAlertTypeColor(selectedAlert.type)}`}>
                      {getAlertTypeLabel(selectedAlert.type)}
                    </span>
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Status</h3>
                  <p className="text-sm">
                    <span className={`px-2 py-0.5 rounded-full ${getAlertStatusColor(selectedAlert.status)}`}>
                      {getAlertStatusLabel(selectedAlert.status)}
                    </span>
                  </p>
                </div>
                {selectedAlert.readAt && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500">Lido em</h3>
                    <p className="text-sm flex items-center">
                      <FiCheck className="mr-1" />
                      {formatDate(selectedAlert.readAt)}
                    </p>
                  </div>
                )}
                {selectedAlert.message && (
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-gray-500">Mensagem</h3>
                    <p className="text-sm">{selectedAlert.message}</p>
                  </div>
                )}
              </div>
              
              {selectedAlert.thumbnailUrl ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Captura do Momento</h3>
                  <div className="relative bg-black rounded-md h-[350px] w-full flex items-center justify-center">
                    <Image 
                      src={selectedAlert.thumbnailUrl}
                      alt="Captura do alerta"
                      fill
                      style={{ objectFit: 'contain' }}
                      className="rounded-md"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative bg-gray-100 rounded-md h-[350px] w-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <FiImage className="text-6xl mb-2 mx-auto" />
                    <p>Captura não disponível</p>
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <Link 
                  href={`/dashboard/cameras/${selectedAlert.cameraId}`} 
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  <FiEye className="mr-1" />
                  Ver câmera
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-center items-center h-full text-gray-500">
              <FiAlertTriangle className="text-6xl mb-4" />
              <p className="text-xl">Selecione um alerta para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
