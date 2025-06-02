'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCameraById, Camera } from '@/services/cameraService'
import { updateRetentionSetting } from '@/services/recordingService'

export default function RetentionSettingPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useAuth()
  
  const [camera, setCamera] = useState<Camera | null>(null)
  const [retentionDays, setRetentionDays] = useState<number>(7)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const cameraId = params.id as string
  
  // Carregar detalhes da câmera
  useEffect(() => {
    const loadCamera = async () => {
      setLoading(true)
      setError(null)
      
      try {
        if (session?.token && cameraId) {
          const cameraData = await fetchCameraById(cameraId, session.token)
          setCamera(cameraData)
          
          // Definir o valor inicial de retenção
          if (cameraData.retention?.days) {
            setRetentionDays(cameraData.retention.days)
          }
        }
      } catch (err) {
        setError('Falha ao carregar detalhes da câmera. Tente novamente.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadCamera()
  }, [cameraId, session])
  
  // Manipular salvamento da configuração
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (!session?.token) {
        throw new Error('Sessão não encontrada')
      }
      
      await updateRetentionSetting(cameraId, retentionDays, session.token)
      setSuccess('Configuração de retenção atualizada com sucesso!')
      
      // Atualizar dados da câmera
      const updatedCamera = await fetchCameraById(cameraId, session.token)
      setCamera(updatedCamera)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao atualizar configuração'
      setError(errorMessage)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) return <div className="text-center py-10">Carregando detalhes da câmera...</div>
  if (!camera) return <div className="text-center py-10">Câmera não encontrada</div>
  
  return (
    <div>
      <div className="flex items-center mb-6 space-x-4">
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-bold">Configuração de Retenção</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{camera.name}</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Configure o período de retenção das gravações desta câmera. As gravações mais antigas que o período configurado 
            serão removidas automaticamente do sistema.
          </p>
          
          <div className="mb-4">
            <label htmlFor="retentionDays" className="block text-sm font-medium text-gray-700 mb-2">
              Dias de Retenção
            </label>
            <select
              id="retentionDays"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full sm:w-64 p-2 border border-gray-300 rounded"
              disabled={saving}
            >
              <option value="1">1 dia</option>
              <option value="3">3 dias</option>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
            </select>
          </div>
          
          <div className="mt-8">
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h3 className="text-md font-semibold mb-2">Informações importantes:</h3>
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>A limpeza das gravações é executada automaticamente uma vez por dia.</li>
                <li>As gravações são armazenadas na Wasabi e removidas permanentemente após o período de retenção.</li>
                <li>A configuração de retenção pode ser alterada a qualquer momento.</li>
                <li>Gravações removidas não podem ser recuperadas.</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>
    </div>
  )
} 