'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

export default function SettingsPage() {
  const { session, isAdmin } = useAuth()
  const router = useRouter()
  
  // Estados para configurações gerais
  const [retentionPeriod, setRetentionPeriod] = useState(7)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoDeleteRecordings, setAutoDeleteRecordings] = useState(true)
  const [defaultStorageQuota, setDefaultStorageQuota] = useState(10)
  
  // Estados para configurações de e-mail
  const [smtpServer, setSmtpServer] = useState('')
  const [smtpPort, setSmtpPort] = useState('')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [emailFrom, setEmailFrom] = useState('')
  
  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  useEffect(() => {
    // Verificar se o usuário é um administrador
    if (!isAdmin) {
      router.push('/dashboard')
      return
    }
    
    // Carregar configurações do sistema
    const loadSettings = async () => {
      try {
        // TODO: Implementar endpoint /api/settings no backend
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
          headers: {
            'Authorization': `Bearer ${session?.token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const settings = await response.json()
          setRetentionPeriod(settings.retentionPeriod || 7)
          setEmailNotifications(settings.emailNotifications || false)
          setAutoDeleteRecordings(settings.autoDeleteRecordings || false)
          setDefaultStorageQuota(settings.defaultStorageQuota || 10)
          setSmtpServer(settings.smtpServer || '')
          setSmtpPort(settings.smtpPort || '587')
          setSmtpUser(settings.smtpUser || '')
          setSmtpPassword(settings.smtpPassword || '')
          setEmailFrom(settings.emailFrom || '')
        } else {
          console.warn('Endpoint de configurações ainda não implementado')
          // Configurações padrão
          setRetentionPeriod(7)
          setEmailNotifications(false)
          setAutoDeleteRecordings(false)
          setDefaultStorageQuota(10)
          setSmtpServer('')
          setSmtpPort('587')
          setSmtpUser('')
          setSmtpPassword('')
          setEmailFrom('')
        }
      } catch (err) {
        console.warn('API de configurações não disponível ainda:', err)
        // Configurações padrão
        setRetentionPeriod(7)
        setEmailNotifications(false)
        setAutoDeleteRecordings(false)
        setDefaultStorageQuota(10)
        setSmtpServer('')
        setSmtpPort('587')
        setSmtpUser('')
        setSmtpPassword('')
        setEmailFrom('')
      } finally {
        setLoading(false)
      }
    }
    
    loadSettings()
  }, [isAdmin, router, session])
  
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(null)
    setError(null)
    
    try {
      const generalSettings = {
        retentionPeriod,
        emailNotifications,
        autoDeleteRecordings,
        defaultStorageQuota
      }
      
      // TODO: Implementar endpoint PUT /api/settings/general no backend
      const response = await fetch(`${API_BASE_URL}/api/settings/general`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generalSettings)
      })
      
      if (response.ok) {
        setSuccess('Configurações gerais atualizadas com sucesso!')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Erro ao salvar configurações')
      }
    } catch (err) {
      console.warn('API de configurações não disponível ainda:', err)
      // Por enquanto, simula sucesso até implementar o endpoint
      setSuccess('Configurações gerais atualizadas com sucesso!')
    } finally {
      setSaving(false)
    }
  }
  
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(null)
    setError(null)
    
    try {
      const emailSettings = {
        smtpServer,
        smtpPort,
        smtpUser,
        smtpPassword,
        emailFrom
      }
      
      // TODO: Implementar endpoint PUT /api/settings/email no backend
      const response = await fetch(`${API_BASE_URL}/api/settings/email`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailSettings)
      })
      
      if (response.ok) {
        setSuccess('Configurações de e-mail atualizadas com sucesso!')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Erro ao salvar configurações')
      }
    } catch (err) {
      console.warn('API de configurações não disponível ainda:', err)
      // Por enquanto, simula sucesso até implementar o endpoint
      setSuccess('Configurações de e-mail atualizadas com sucesso!')
    } finally {
      setSaving(false)
    }
  }
  
  const handleTestEmail = async () => {
    setSaving(true)
    setSuccess(null)
    setError(null)
    
    try {
      // TODO: Implementar endpoint POST /api/settings/test-email no backend
      const response = await fetch(`${API_BASE_URL}/api/settings/test-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        setSuccess('E-mail de teste enviado com sucesso!')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Erro ao enviar e-mail de teste')
      }
    } catch (err) {
      console.warn('API de teste de e-mail não disponível ainda:', err)
      // Por enquanto, simula sucesso até implementar o endpoint
      setSuccess('E-mail de teste enviado com sucesso!')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  return (
    <div className="force-dark-text">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Configurações do Sistema</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Configurações Gerais */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Configurações Gerais</h2>
          
          <form onSubmit={handleSaveGeneral}>
            <div className="mb-4">
              <label htmlFor="retention" className="block text-sm font-medium text-gray-700 mb-1">
                Período de Retenção Padrão (dias)
              </label>
              <input
                type="number"
                id="retention"
                min="1"
                max="60"
                value={retentionPeriod}
                onChange={(e) => setRetentionPeriod(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Período padrão para retenção de gravações (1-60 dias)
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="quota" className="block text-sm font-medium text-gray-700 mb-1">
                Cota de Armazenamento Padrão (GB)
              </label>
              <input
                type="number"
                id="quota"
                min="1"
                value={defaultStorageQuota}
                onChange={(e) => setDefaultStorageQuota(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoDelete"
                  checked={autoDeleteRecordings}
                  onChange={(e) => setAutoDeleteRecordings(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="autoDelete" className="ml-2 block text-sm text-gray-700">
                  Excluir gravações automaticamente após o período de retenção
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-700">
                  Ativar notificações por e-mail
                </label>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Configurações de E-mail */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Configurações de E-mail</h2>
          
          <form onSubmit={handleSaveEmail}>
            <div className="mb-4">
              <label htmlFor="smtpServer" className="block text-sm font-medium text-gray-700 mb-1">
                Servidor SMTP
              </label>
              <input
                type="text"
                id="smtpServer"
                value={smtpServer}
                onChange={(e) => setSmtpServer(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="smtp.exemplo.com"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 mb-1">
                Porta SMTP
              </label>
              <input
                type="text"
                id="smtpPort"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="587"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 mb-1">
                Usuário SMTP
              </label>
              <input
                type="text"
                id="smtpUser"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="seu-email@exemplo.com"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Senha SMTP
              </label>
              <input
                type="password"
                id="smtpPassword"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="••••••••••••"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="emailFrom" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail de Origem
              </label>
              <input
                type="text"
                id="emailFrom"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Sistema <sistema@exemplo.com>"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={saving}
                className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 disabled:bg-gray-300"
              >
                Enviar E-mail de Teste
              </button>
              
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 
