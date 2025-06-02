'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCameras, Camera } from '@/services/cameraService'
import { fetchRecordings, startContinuousRecording, stopContinuousRecording, deleteRecording, Recording, RecordingFilters } from '@/services/recordingService'
import VideoPlayer from '@/components/player/VideoPlayer'
import { FiCalendar, FiClock, FiDownload, FiVideo, FiFileText, FiTrash2, FiPlay, FiSquare } from 'react-icons/fi'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { ImSpinner8 } from 'react-icons/im'

export default function RecordingsPage() {
  const { session, ensureValidSession } = useAuth()
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState<RecordingFilters>({
    startDate: undefined,
    endDate: undefined,
    type: undefined,
    page: 1,
    limit: 10
  })
  const [processingRecording, setProcessingRecording] = useState(false)

  // Estados para controle
  const loadingCamerasRef = useRef(false)
  const loadingRecordingsRef = useRef(false)

  const loadCameras = async () => {
    if (!session?.token || loadingCamerasRef.current) return
    
    try {
      loadingCamerasRef.current = true
      setLoading(true)
      const camerasData = await fetchCameras(session.token)
      setCameras(camerasData)
      
      // Selecionar a primeira câmera por padrão se existir
      if (camerasData.length > 0 && !selectedCamera) {
        setSelectedCamera(camerasData[0])
      }
    } catch (err) {
      console.error('Erro ao carregar câmeras:', err)
      setError('Falha ao carregar câmeras. Tente novamente.')
      toast.error('Falha ao carregar câmeras')
    } finally {
      setLoading(false)
      loadingCamerasRef.current = false
    }
  }

  const loadRecordings = async () => {
    if (!session?.token || !selectedCamera || loadingRecordingsRef.current) return
    
    try {
      loadingRecordingsRef.current = true
      setRecordingsLoading(true)
      const result = await fetchRecordings(selectedCamera.id, filters, session.token)
      setRecordings(result.data)
      setTotalPages(result.meta.totalPages)
      setPage(result.meta.page)
    } catch (err) {
      console.error('Erro ao carregar gravações:', err)
      toast.error('Falha ao carregar gravações')
    } finally {
      setRecordingsLoading(false)
      loadingRecordingsRef.current = false
    }
  }

  // Carregar câmeras apenas uma vez
  useEffect(() => {
    if (session?.token) {
      console.log('🎬 Carregando câmeras para gravações...')
      loadCameras()
    }
  }, [session?.token])
  
  // Carregar gravações quando câmera mudara (simplificado)
  useEffect(() => {
    if (selectedCamera && session?.token) {
      console.log('📼 Carregando gravações para câmera:', selectedCamera.name)
      
      // Carregar imediatamente se não há filtros de data/tipo, senão com pequeno delay
      const delay = (filters.startDate || filters.endDate || filters.type) ? 300 : 0
      
      const timeoutId = setTimeout(() => {
        loadRecordings()
      }, delay)

      return () => clearTimeout(timeoutId)
    }
  }, [selectedCamera?.id, filters.startDate, filters.endDate, filters.type, filters.page])
  
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cameraId = e.target.value
    const camera = cameras.find(c => c.id === cameraId) || null
    setSelectedCamera(camera)
    setSelectedRecording(null)
    // Resetar filtros ao mudar de câmera
    setFilters({
      ...filters,
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
  
  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({
      ...filters,
      type: e.target.value === 'all' ? undefined : e.target.value,
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
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    }
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    
    return `${remainingSeconds}s`
  }
  
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })
  }
  
  const handleDeleteRecording = async (recordingId: string) => {
    if (!session?.token) return
    
    if (!confirm('Tem certeza que deseja excluir esta gravação? Esta ação não pode ser desfeita.')) {
      return
    }
    
    try {
      await deleteRecording(recordingId, session.token)
      
      // Remover a gravação da lista
      setRecordings(prev => prev.filter(r => r.id !== recordingId))
      
      // Se a gravação selecionada for a que está sendo excluída, limpar a seleção
      if (selectedRecording?.id === recordingId) {
        setSelectedRecording(null)
      }
      
      toast.success('Gravação excluída com sucesso')
    } catch (err) {
      console.error('Erro ao excluir gravação:', err)
      toast.error('Falha ao excluir gravação')
    }
  }
  
  const handleStartRecording = async () => {
    if (!session?.token || !selectedCamera) return
    
    setProcessingRecording(true)
    try {
      console.log('🎬 Iniciando gravação contínua...')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recordings/start/${selectedCamera.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        console.log('✅ Gravação iniciada:', data)
        toast.success('Gravação contínua iniciada com sucesso')
        
        // Atualizar status da câmera
        setSelectedCamera(prev => prev ? { ...prev, recordingStatus: 'CONTINUOUS' } : null)
        
        // Recarregar lista de câmeras para atualizar status
        await loadCameras()
      } else {
        throw new Error(data.message || 'Erro ao iniciar gravação')
      }
    } catch (err) {
      console.error('❌ Erro ao iniciar gravação:', err)
      toast.error(`Falha ao iniciar gravação: ${err.message}`)
    } finally {
      setProcessingRecording(false)
    }
  }

  const handleStopRecording = async () => {
    if (!session?.token || !selectedCamera) return
    
    setProcessingRecording(true)
    try {
      console.log('🛑 Parando gravação contínua...')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/recordings/stop/${selectedCamera.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        console.log('✅ Gravação parada:', data)
        toast.success('Gravação contínua parada com sucesso')
        
        // Atualizar status da câmera
        setSelectedCamera(prev => prev ? { ...prev, recordingStatus: 'INACTIVE' } : null)
        
        // Recarregar lista de câmeras para atualizar status
        await loadCameras()
      } else {
        throw new Error(data.message || 'Erro ao parar gravação')
      }
    } catch (err) {
      console.error('❌ Erro ao parar gravação:', err)
      toast.error(`Falha ao parar gravação: ${err.message}`)
    } finally {
      setProcessingRecording(false)
    }
  }

  const handleDownloadRecording = async (recording: Recording) => {
    if (!recording.url) {
      toast.error('URL de download não disponível')
      return
    }
    
    try {
      console.log('📥 Iniciando download da gravação:', recording.filename)
      
      // Criar URL de download usando a estrutura do worker
      const downloadUrl = recording.url.replace('/api/recordings/stream/', '/api/recordings/download/')
        .replace(recording.filename, `${recording.cameraId}/${recording.filename}`)
      
      // Abrir em nova aba para download
      window.open(downloadUrl, '_blank')
      
      toast.success('Download iniciado')
    } catch (err) {
      console.error('❌ Erro no download:', err)
      toast.error('Falha ao fazer download')
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
  
  if (cameras.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FiVideo className="text-yellow-500 text-5xl mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Nenhuma câmera disponível</h2>
        <p className="text-gray-600 mb-4">
          Não foram encontradas câmeras para visualização de gravações.
        </p>
      </div>
    )
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Gravações</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between mb-6 gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Câmera</label>
            <select
              value={selectedCamera?.id || ''}
              onChange={handleCameraChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filters.type || 'all'}
              onChange={handleTypeFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              <option value="CONTINUOUS">Contínua</option>
              <option value="MANUAL">Manual</option>
              <option value="MOTION">Movimento</option>
              <option value="SCHEDULED">Agendada</option>
            </select>
          </div>
        </div>
        
        {selectedCamera && selectedCamera.status === 'online' && (
          <div className="flex justify-end mb-6">
            {selectedCamera.recordingStatus !== 'CONTINUOUS' ? (
              <button
                onClick={handleStartRecording}
                disabled={processingRecording}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
              >
                {processingRecording ? (
                  <ImSpinner8 className="animate-spin mr-2" />
                ) : (
                  <FiPlay className="mr-2" />
                )}
                Iniciar Gravação Contínua
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                disabled={processingRecording}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center"
              >
                {processingRecording ? (
                  <ImSpinner8 className="animate-spin mr-2" />
                ) : (
                  <FiSquare className="mr-2" />
                )}
                Parar Gravação Contínua
              </button>
            )}
          </div>
        )}
        
        {selectedCamera && selectedCamera.recordingStatus === 'CONTINUOUS' && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <FiVideo className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Esta câmera está em modo de gravação contínua. Novos vídeos serão adicionados automaticamente a cada 30 minutos.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white rounded-lg shadow-md p-4 h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Lista de Gravações</h2>
          
          {recordingsLoading ? (
            <div className="flex justify-center items-center h-64">
              <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiFileText className="text-4xl mx-auto mb-2" />
              <p>Nenhuma gravação encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {recordings.map(recording => (
                  <div 
                    key={recording.id} 
                    className={`p-3 border rounded-md cursor-pointer transition ${
                      selectedRecording?.id === recording.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedRecording(recording)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm truncate">{recording.filename}</div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <FiCalendar className="mr-1" />
                          {format(parseISO(recording.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <FiClock className="mr-1" />
                          {format(parseISO(recording.date), 'HH:mm:ss')}
                        </div>
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          recording.recordingType === 'CONTINUOUS' ? 'bg-blue-100 text-blue-800' :
                          recording.recordingType === 'MOTION' ? 'bg-yellow-100 text-yellow-800' :
                          recording.recordingType === 'SCHEDULED' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {recording.recordingType === 'CONTINUOUS' ? 'Contínua' :
                           recording.recordingType === 'MOTION' ? 'Movimento' :
                           recording.recordingType === 'SCHEDULED' ? 'Agendada' :
                           'Manual'}
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
          {selectedRecording ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Visualização</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDownloadRecording(selectedRecording)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center text-sm"
                  >
                    <FiDownload className="mr-1" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDeleteRecording(selectedRecording.id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center text-sm"
                  >
                    <FiTrash2 className="mr-1" />
                    Excluir
                  </button>
                </div>
              </div>
              
              <div className="relative bg-black rounded-md h-[350px] mb-4">
                <VideoPlayer 
                  url={`http://localhost:3002/api/recordings/stream/${selectedRecording.url}`} 
                  height="350px" 
                  width="100%"
                  showControls={true}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Nome do Arquivo</h3>
                  <p className="text-sm">{selectedRecording.filename}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Data de Gravação</h3>
                  <p className="text-sm">{formatDate(selectedRecording.date)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Duração</h3>
                  <p className="text-sm">{formatDuration(selectedRecording.duration)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Tamanho</h3>
                  <p className="text-sm">{formatFileSize(selectedRecording.size)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500">Tipo de Gravação</h3>
                  <p className="text-sm">
                    <span className={`px-2 py-0.5 rounded-full ${
                      selectedRecording.recordingType === 'CONTINUOUS' ? 'bg-blue-100 text-blue-800' :
                      selectedRecording.recordingType === 'MOTION' ? 'bg-yellow-100 text-yellow-800' :
                      selectedRecording.recordingType === 'SCHEDULED' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedRecording.recordingType === 'CONTINUOUS' ? 'Contínua' :
                       selectedRecording.recordingType === 'MOTION' ? 'Movimento' :
                       selectedRecording.recordingType === 'SCHEDULED' ? 'Agendada' :
                       'Manual'}
                    </span>
                  </p>
                </div>
                {selectedRecording.triggerEvent && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500">Evento de Gatilho</h3>
                    <p className="text-sm">{selectedRecording.triggerEvent}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-center items-center h-full text-gray-500">
              <FiVideo className="text-6xl mb-4" />
              <p className="text-xl">Selecione uma gravação para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 