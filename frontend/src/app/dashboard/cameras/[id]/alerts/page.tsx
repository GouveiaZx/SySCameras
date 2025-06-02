'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCameraById, Camera } from '@/services/cameraService'
import { 
  fetchAlertConfigurations, 
  createAlertConfiguration, 
  updateAlertConfiguration, 
  deleteAlertConfiguration, 
  AlertConfiguration 
} from '@/services/alertService'

export default function CameraAlertsPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useAuth()
  
  const [camera, setCamera] = useState<Camera | null>(null)
  const [alertConfigurations, setAlertConfigurations] = useState<AlertConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Estados para o formulário de nova configuração
  const [emails, setEmails] = useState<string>('')
  const [notifyOnline, setNotifyOnline] = useState<boolean>(true)
  const [notifyOffline, setNotifyOffline] = useState<boolean>(true)
  const [isAdding, setIsAdding] = useState<boolean>(false)
  const [showAddForm, setShowAddForm] = useState<boolean>(false)
  
  const cameraId = params.id as string
  
  // Carregar detalhes da câmera e configurações de alertas
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        if (session?.token && cameraId) {
          // Carregar detalhes da câmera
          const cameraData = await fetchCameraById(cameraId, session.token)
          setCamera(cameraData)
          
          // Carregar configurações de alertas
          const alertConfigs = await fetchAlertConfigurations(session.token, cameraId)
          setAlertConfigurations(alertConfigs)
        }
      } catch (err) {
        setError('Falha ao carregar dados. Tente novamente.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [cameraId, session])
  
  // Criar nova configuração de alerta
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAdding(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (!session?.token) {
        throw new Error('Sessão não encontrada')
      }
      
      const emailList = emails.split(',').map(email => email.trim()).filter(email => email)
      
      if (emailList.length === 0) {
        throw new Error('Adicione pelo menos um e-mail válido')
      }
      
      const newConfig = await createAlertConfiguration({
        cameraId,
        emailAddresses: emailList,
        notifyOnline,
        notifyOffline
      }, session.token)
      
      setAlertConfigurations([newConfig, ...alertConfigurations])
      setSuccess('Configuração de alerta criada com sucesso!')
      
      // Limpar formulário
      setEmails('')
      setNotifyOnline(true)
      setNotifyOffline(true)
      setShowAddForm(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao criar configuração'
      setError(errorMessage)
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }
  
  // Excluir configuração de alerta
  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração de alerta?')) {
      return
    }
    
    setError(null)
    setSuccess(null)
    
    try {
      if (!session?.token) {
        throw new Error('Sessão não encontrada')
      }
      
      await deleteAlertConfiguration(id, session.token)
      
      // Atualizar lista local
      setAlertConfigurations(alertConfigurations.filter(config => config.id !== id))
      setSuccess('Configuração de alerta excluída com sucesso!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao excluir configuração'
      setError(errorMessage)
      console.error(err)
    }
  }
  
  if (loading) return <div className="text-center py-10">Carregando...</div>
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
        <h1 className="text-3xl font-bold">Alertas de Câmera</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{camera.name}</h2>
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
            Configure notificações por e-mail para quando esta câmera ficar online ou offline.
            Você pode adicionar múltiplos endereços de e-mail para receber alertas.
          </p>
          
          {(session?.user?.role === 'INTEGRATOR' || session?.user?.role === 'ADMIN') && (
            <div className="mb-4">
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Adicionar Nova Configuração
                </button>
              ) : (
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h3 className="text-lg font-medium mb-3">Nova Configuração de Alerta</h3>
                  
                  <form onSubmit={handleCreateAlert}>
                    <div className="mb-3">
                      <label htmlFor="emails" className="block text-sm font-medium text-gray-700 mb-1">
                        E-mails para notificação
                      </label>
                      <input
                        type="text"
                        id="emails"
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        placeholder="email1@exemplo.com, email2@exemplo.com"
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separe múltiplos e-mails por vírgula
                      </p>
                    </div>
                    
                    <div className="flex mb-3 space-x-6">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifyOnline"
                          checked={notifyOnline}
                          onChange={(e) => setNotifyOnline(e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="notifyOnline" className="text-sm">
                          Notificar quando online
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifyOffline"
                          checked={notifyOffline}
                          onChange={(e) => setNotifyOffline(e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="notifyOffline" className="text-sm">
                          Notificar quando offline
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        disabled={isAdding}
                      >
                        {isAdding ? 'Salvando...' : 'Salvar'}
                      </button>
                      
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        onClick={() => setShowAddForm(false)}
                        disabled={isAdding}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
        
        <h3 className="text-lg font-semibold mb-3">Configurações de Alerta</h3>
        
        {alertConfigurations.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              Nenhuma configuração de alerta encontrada para esta câmera.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {alertConfigurations.map((config) => (
              <div key={config.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Configuração de Alerta</p>
                    <p className="text-sm text-gray-600">Criada em: {new Date(config.createdAt).toLocaleDateString()}</p>
                    
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">E-mails para notificação:</p>
                      <ul className="text-sm text-gray-600">
                        {config.emailAddresses.map((email, idx) => (
                          <li key={idx}>{email}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-2 flex space-x-4">
                      <div className="flex items-center">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${config.notifyOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="text-sm">Online</span>
                      </div>
                      
                      <div className="flex items-center">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${config.notifyOffline ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                        <span className="text-sm">Offline</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <button
                      onClick={() => handleDeleteAlert(config.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 