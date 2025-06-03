'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchCameraById, updateCamera, Camera } from '@/services/cameraService'
import { fetchClients, Client } from '@/services/clientService'
import { useAuth } from '@/contexts/AuthContext'

export default function EditCameraPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useAuth()
  
  const cameraId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [rtspUrl, setRtspUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [cameraType, setCameraType] = useState<'IP' | 'ANALOG'>('IP')
  const [retentionDays, setRetentionDays] = useState(7)
  
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  
  useEffect(() => {
    const loadData = async () => {
      try {
        if (session?.token) {
          // Carregar detalhes da câmera
          const cameraData = await fetchCameraById(cameraId, session.token)
          setName(cameraData.name)
          setRtspUrl(cameraData.rtspUrl || '')
          setClientId(cameraData.clientId)
          setCameraType(cameraData.type || 'IP')
          setRetentionDays(cameraData.retention?.days || 7)
          
          // Carregar lista de clientes
          const clientsData = await fetchClients(session.token)
          setClients(clientsData)
          setLoadingClients(false)
        }
      } catch (err) {
        setError('Falha ao carregar dados da câmera. Tente novamente.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [cameraId, session])
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      if (!session?.token) {
        throw new Error('Você precisa estar autenticado para editar câmeras')
      }
      
      await updateCamera(cameraId, {
        name,
        rtspUrl,
        clientId,
        type: cameraType,
        retentionDays
      }, session.token)
      
      router.push(`/dashboard/cameras/${cameraId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao atualizar câmera'
      setError(errorMessage)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) return <div className="text-center py-10">Carregando dados da câmera...</div>
  
  return (
    <div>
      <div className="flex items-center mb-6 space-x-4">
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-bold">Editar Câmera</h1>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Câmera
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="rtspUrl" className="block text-sm font-medium text-gray-700 mb-1">
              URL RTSP
            </label>
            <input
              id="rtspUrl"
              type="text"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://usuário:senha@ip-da-camera:porta/stream"
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              URL RTSP fornecida pelo fabricante da câmera ou administrador da rede.
            </p>
          </div>
          
          <div className="mb-4">
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              required
              disabled={loadingClients}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {loadingClients && (
              <p className="mt-1 text-sm text-gray-500">Carregando clientes...</p>
            )}
          </div>
          
          <div className="mb-4">
            <label htmlFor="cameraType" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo da Câmera
            </label>
            <select
              id="cameraType"
              value={cameraType}
              onChange={(e) => setCameraType(e.target.value as 'IP' | 'ANALOG')}
              className="w-full p-2 border border-gray-300 rounded"
              required
            >
              <option value="IP">IP</option>
              <option value="ANALOG">Analógica</option>
            </select>
          </div>
          
          <div className="mb-6">
            <label htmlFor="retentionDays" className="block text-sm font-medium text-gray-700 mb-1">
              Dias de Retenção
            </label>
            <select
              id="retentionDays"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded"
              required
            >
              <option value="1">1 dia</option>
              <option value="3">3 dias</option>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Período que as gravações serão mantidas antes da limpeza automática.
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/cameras/${cameraId}`)}
              className="py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 