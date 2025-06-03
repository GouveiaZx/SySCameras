'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ImSpinner8 } from 'react-icons/im'
import { FiPlus, FiEdit2, FiEye, FiUserCheck, FiUserX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { fetchIntegrators, type Integrator } from '@/services/adminService'

export default function IntegratorsPage() {
  const router = useRouter()
  const { user, isAdmin, session } = useAuth()
  const [integrators, setIntegrators] = useState<Integrator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar se o usuário é um administrador
    if (!isAdmin) {
      router.push('/dashboard')
      return
    }

    const loadIntegrators = async () => {
      if (!session?.token) return
      
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔄 Carregando integradores na página...')
        const response = await fetchIntegrators({}, session.token)
        console.log('📊 Resposta dos integradores:', response)
        
        // fetchIntegrators retorna { data, meta }
        setIntegrators(response.data || [])
        console.log('✅ Integradores carregados:', (response.data || []).length)
      } catch (err) {
        console.error('❌ Erro ao carregar integradores:', err)
        setError('Falha ao carregar a lista de integradores. Tente novamente.')
        toast.error('Falha ao carregar integradores')
      } finally {
        setLoading(false)
      }
    }

    loadIntegrators()
  }, [isAdmin, router, session])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    )
  }

  return (
    <div className="force-dark-text">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Integradores</h1>
        <button 
          onClick={() => toast('Funcionalidade de adicionar integrador será implementada em breve')}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 flex items-center"
        >
          <FiPlus className="mr-2" />
          Adicionar Integrador
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 force-dark-text">
          {error}
        </div>
      )}

      {!integrators || integrators.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">Nenhum integrador cadastrado ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-mail
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clientes
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Câmeras
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data de Criação
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {integrators.map((integrator) => (
                <tr key={integrator.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{integrator.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {integrator.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {integrator.clientsCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {integrator.camerasCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(integrator.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => toast('Funcionalidade de detalhes será implementada em breve')}
                        className="text-blue-600 hover:text-blue-900"
                        title="Ver detalhes"
                      >
                        <FiEye />
                      </button>
                      <button 
                        onClick={() => toast('Funcionalidade de edição será implementada em breve')}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Editar integrador"
                      >
                        <FiEdit2 />
                      </button>
                      <button 
                        onClick={() => toast('Funcionalidade de ativar/desativar será implementada em breve')}
                        className={`${integrator.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        title={integrator.status === 'active' ? 'Desativar' : 'Ativar'}
                      >
                        {integrator.status === 'active' ? <FiUserX /> : <FiUserCheck />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Informação sobre total de integradores */}
      <div className="mt-4 text-sm text-gray-600">
        Total: {integrators?.length || 0} integrador{(integrators?.length || 0) !== 1 ? 'es' : ''}
      </div>
    </div>
  )
} 