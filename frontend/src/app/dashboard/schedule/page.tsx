'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCameras, Camera } from '@/services/cameraService'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Schedule {
  id: string;
  cameraId: string;
  camera?: {
    name: string;
  };
  days: string[]; // Dias da semana: 'monday', 'tuesday', etc.
  startTime: string; // formato HH:MM
  endTime: string; // formato HH:MM
  createdAt: string;
}

export default function SchedulePage() {
  const router = useRouter()
  const { session } = useAuth()
  
  // Estados para listagem
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para formulário
  const [showForm, setShowForm] = useState(false)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('23:59')
  const [formError, setFormError] = useState<string | null>(null)
  
  const weekdays = [
    { value: 'monday', label: 'Segunda-feira' },
    { value: 'tuesday', label: 'Terça-feira' },
    { value: 'wednesday', label: 'Quarta-feira' },
    { value: 'thursday', label: 'Quinta-feira' },
    { value: 'friday', label: 'Sexta-feira' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ]

  useEffect(() => {
    const loadData = async () => {
      try {
        if (session?.token) {
          // Carrega as câmeras
          const camerasData = await fetchCameras(session.token)
          setCameras(camerasData)
          
          // Carregar agendamentos reais da API
          // TODO: Implementar endpoint /api/schedules no backend
          try {
            const response = await fetch(`${API_BASE_URL}/api/schedules`, {
              headers: {
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const schedulesData = await response.json()
              setSchedules(schedulesData)
            } else {
              console.warn('Endpoint de agendamentos ainda não implementado')
              setSchedules([]) // Lista vazia até implementar o endpoint
            }
          } catch (apiError) {
            console.warn('API de agendamentos não disponível ainda:', apiError)
            setSchedules([]) // Lista vazia até implementar o endpoint
          }
        }
      } catch (err) {
        setError('Falha ao carregar dados. Tente novamente.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [session])
  
  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day))
    } else {
      setSelectedDays([...selectedDays, day])
    }
  }
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    // Validações básicas
    if (!selectedCamera) {
      setFormError('Selecione uma câmera')
      return
    }
    
    if (selectedDays.length === 0) {
      setFormError('Selecione pelo menos um dia da semana')
      return
    }
    
    if (startTime >= endTime) {
      setFormError('O horário de início deve ser anterior ao horário de término')
      return
    }
    
    try {
      // Preparar dados para envio
      const scheduleData = {
        cameraId: selectedCamera,
        days: selectedDays,
        startTime,
        endTime
      }
      
      // Enviar para a API
      // TODO: Implementar endpoint POST /api/schedules no backend
      const response = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      })
      
      if (response.ok) {
        const newSchedule = await response.json()
        setSchedules([...schedules, newSchedule])
        
        // Reset do formulário
        setSelectedCamera('')
        setSelectedDays([])
        setStartTime('00:00')
        setEndTime('23:59')
        setShowForm(false)
      } else {
        const errorData = await response.json()
        setFormError(errorData.message || 'Falha ao criar agendamento')
      }
    } catch (err) {
      setFormError('Falha ao criar agendamento. Tente novamente.')
      console.error(err)
    }
  }
  
  const handleDelete = async (scheduleId: string) => {
    try {
      // TODO: Implementar endpoint DELETE /api/schedules/:id no backend
      const response = await fetch(`${API_BASE_URL}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        setSchedules(schedules.filter(s => s.id !== scheduleId))
      } else {
        console.error('Falha ao deletar agendamento')
      }
    } catch (err) {
      console.error('Erro ao deletar agendamento:', err)
      // Por enquanto, remove localmente até implementar o endpoint
      setSchedules(schedules.filter(s => s.id !== scheduleId))
    }
  }
  
  if (loading) return <div className="text-center py-10">Carregando agendamentos...</div>
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Agendamento de Gravações</h1>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          {showForm ? 'Cancelar' : 'Novo Agendamento'}
        </button>
      </div>
      
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Novo Agendamento</h2>
          
          {formError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {formError}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="camera" className="block text-sm font-medium text-gray-700 mb-1">
                Câmera
              </label>
              <select
                id="camera"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                required
              >
                <option value="">Selecione uma câmera</option>
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dias da Semana
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {weekdays.map((day) => (
                  <div key={day.value} className="flex items-center">
                    <input
                      type="checkbox"
                      id={day.value}
                      checked={selectedDays.includes(day.value)}
                      onChange={() => handleDayToggle(day.value)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2"
                    />
                    <label htmlFor={day.value} className="text-sm text-gray-700">
                      {day.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Horário de Início
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Horário de Término
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
              >
                Salvar Agendamento
              </button>
            </div>
          </form>
        </div>
      )}
      
      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">Você ainda não possui agendamentos de gravação.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Criar Agendamento
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold">{schedule.camera?.name}</h2>
                    <p className="text-gray-600 mt-1">
                      {schedule.startTime} - {schedule.endTime}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Excluir
                  </button>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">Dias da semana:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {schedule.days.map((day) => (
                      <span
                        key={day}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {weekdays.find(d => d.value === day)?.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 