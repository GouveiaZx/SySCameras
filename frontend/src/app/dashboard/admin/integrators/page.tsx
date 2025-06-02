'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { 
  fetchIntegrators, 
  createIntegrator, 
  updateIntegrator,
  Integrator,
  IntegratorFilters
} from '@/services/adminService'
import { 
  FiUsers, 
  FiSearch, 
  FiPlus, 
  FiEdit, 
  FiToggleLeft, 
  FiToggleRight,
  FiCheck,
  FiX,
  FiCalendar,
  FiCamera,
  FiUser
} from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function IntegratorsPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [integrators, setIntegrators] = useState<Integrator[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<IntegratorFilters>({
    search: '',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    limit: 10
  })
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedIntegrator, setSelectedIntegrator] = useState<Integrator | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })

  // Verificar se o usuário é admin
  useEffect(() => {
    if (session && session.user && session.user.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, router])

  // Carregar integradores
  useEffect(() => {
    const loadIntegrators = async () => {
      if (!session?.token) return

      try {
        setLoading(true)
        const result = await fetchIntegrators(filters, session.token)
        setIntegrators(result.data)
        setTotalPages(result.meta.totalPages)
      } catch (error) {
        console.error('Erro ao carregar integradores:', error)
        toast.error('Falha ao carregar integradores')
      } finally {
        setLoading(false)
      }
    }

    loadIntegrators()
  }, [filters, session])

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      search: e.target.value,
      page: 1
    })
  }

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({
      ...filters,
      status: e.target.value as 'active' | 'inactive' | 'all',
      page: 1
    })
  }

  const handleSortChange = (sortBy: string) => {
    const newSortOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc'
    setFilters({
      ...filters,
      sortBy,
      sortOrder: newSortOrder
    })
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    
    setFilters({
      ...filters,
      page: newPage
    })
  }

  const handleToggleIntegratorStatus = async (integrator: Integrator) => {
    if (!session?.token) return
    
    try {
      const updatedIntegrator = await updateIntegrator(
        integrator.id, 
        { active: !integrator.active }, 
        session.token
      )
      
      // Atualizar a lista
      setIntegrators(prev => 
        prev.map(item => item.id === updatedIntegrator.id ? updatedIntegrator : item)
      )
      
      toast.success(`Integrador ${updatedIntegrator.active ? 'ativado' : 'desativado'} com sucesso`)
    } catch (error) {
      console.error('Erro ao atualizar status do integrador:', error)
      toast.error('Falha ao atualizar status do integrador')
    }
  }

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      email: '',
      password: ''
    })
    setShowCreateModal(true)
  }

  const handleOpenEditModal = (integrator: Integrator) => {
    setSelectedIntegrator(integrator)
    setFormData({
      name: integrator.name,
      email: integrator.email,
      password: ''
    })
    setShowEditModal(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleCreateIntegrator = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session?.token) return
    
    try {
      await createIntegrator(formData, session.token)
      
      // Recarregar lista
      const result = await fetchIntegrators(filters, session.token)
      setIntegrators(result.data)
      setTotalPages(result.meta.totalPages)
      
      // Fechar modal
      setShowCreateModal(false)
      toast.success('Integrador criado com sucesso')
    } catch (error) {
      console.error('Erro ao criar integrador:', error)
      toast.error('Falha ao criar integrador')
    }
  }

  const handleUpdateIntegrator = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session?.token || !selectedIntegrator) return
    
    try {
      // Se a senha estiver vazia, não a envie na atualização
      const updateData = {
        name: formData.name,
        email: formData.email,
        ...(formData.password ? { password: formData.password } : {})
      }
      
      const updatedIntegrator = await updateIntegrator(
        selectedIntegrator.id, 
        updateData, 
        session.token
      )
      
      // Atualizar a lista
      setIntegrators(prev => 
        prev.map(item => item.id === updatedIntegrator.id ? updatedIntegrator : item)
      )
      
      // Fechar modal
      setShowEditModal(false)
      toast.success('Integrador atualizado com sucesso')
    } catch (error) {
      console.error('Erro ao atualizar integrador:', error)
      toast.error('Falha ao atualizar integrador')
    }
  }

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString)
    return format(date, "dd/MM/yyyy", { locale: ptBR })
  }

  if (loading && integrators.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Integradores</h1>
        <button 
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <FiPlus className="mr-1" />
          Novo Integrador
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar integrador..."
                value={filters.search}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <div className="w-full md:w-64">
            <select
              value={filters.status}
              onChange={handleStatusFilter}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Integradores */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('name')}
              >
                <div className="flex items-center">
                  Nome
                  {filters.sortBy === 'name' && (
                    <span className="ml-1">
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('email')}
              >
                <div className="flex items-center">
                  Email
                  {filters.sortBy === 'email' && (
                    <span className="ml-1">
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Clientes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Câmeras
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('createdAt')}
              >
                <div className="flex items-center">
                  Data de Cadastro
                  {filters.sortBy === 'createdAt' && (
                    <span className="ml-1">
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('active')}
              >
                <div className="flex items-center">
                  Status
                  {filters.sortBy === 'active' && (
                    <span className="ml-1">
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {integrators.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Nenhum integrador encontrado
                </td>
              </tr>
            ) : (
              integrators.map((integrator) => (
                <tr key={integrator.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <FiUser className="text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{integrator.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{integrator.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <FiUser className="mr-1" />
                      {integrator.clientsCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <FiCamera className="mr-1" />
                      {integrator.camerasCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <FiCalendar className="mr-1" />
                      {formatDate(integrator.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      integrator.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {integrator.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleOpenEditModal(integrator)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <FiEdit />
                    </button>
                    <button 
                      onClick={() => handleToggleIntegratorStatus(integrator)}
                      className={`${
                        integrator.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {integrator.active ? <FiToggleRight /> : <FiToggleLeft />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-500">
          Mostrando {integrators.length} de {totalPages * filters.limit} integradores
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page === 1}
            className={`px-3 py-1 rounded-md ${
              filters.page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Anterior
          </button>
          <span className="px-3 py-1 bg-blue-600 text-white rounded-md">
            {filters.page}
          </span>
          <button
            onClick={() => handlePageChange(filters.page + 1)}
            disabled={filters.page === totalPages}
            className={`px-3 py-1 rounded-md ${
              filters.page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Modal de Criação */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Novo Integrador</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleCreateIntegrator}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <FiCheck className="mr-1" />
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && selectedIntegrator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Editar Integrador</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleUpdateIntegrator}>
              <div className="mb-4">
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Senha (deixe em branco para manter a atual)
                </label>
                <input
                  type="password"
                  id="edit-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <FiCheck className="mr-1" />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 