'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiSearch } from 'react-icons/fi'
import { ImSpinner8 } from 'react-icons/im'
import toast from 'react-hot-toast'
import { fetchClients, createClient, updateClient, deleteClient, CreateClientData, UpdateClientData } from '@/services/clientService'
import ClientModal from '@/components/clients/ClientModal'

// Tipo para cliente (adaptado para os dados reais do Supabase)
interface Client {
  id: string;
  name: string;
  integratorId: string;
  userId: string;
  email?: string;
  company?: string;
  password?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Interface para dados do modal
interface ClientFormData {
  id?: string;
  name: string;
  email: string;
  company?: string;
  password?: string;
  isActive: boolean;
}

// Interface para o modal (simplificada)
interface ModalState {
  isOpen: boolean;
  client: Client | null;
  mode: 'create' | 'edit';
}

export default function ClientsPage() {
  const { session, isAdmin, isIntegrator } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    client: null,
    mode: 'create'
  })

  // Carregar clientes
  useEffect(() => {
    loadClients()
  }, [session])
  
  const loadClients = async () => {
    if (!session?.token) return
    
    try {
      setLoading(true)
      setError(null)
      
      const clientsData = await fetchClients(session.token)
      setClients(clientsData)
      setFilteredClients(clientsData)
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
      setError('Falha ao carregar a lista de clientes. Tente novamente.')
      toast.error('Falha ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }
  
  // Filtrar clientes quando o termo de busca mudar
  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredClients(filtered)
    } else {
      setFilteredClients(clients)
    }
  }, [searchTerm, clients])

  // Abrir modal para criar cliente
  const openCreateModal = () => {
    setModalState({
      isOpen: true,
      client: null,
      mode: 'create'
    })
  }

  // Abrir modal para editar cliente
  const openEditModal = (client: Client) => {
    setModalState({
      isOpen: true,
      client,
      mode: 'edit'
    })
  }

  // Fechar modal
  const closeModal = () => {
    setModalState({
      isOpen: false,
      client: null,
      mode: 'create'
    })
  }

  // Salvar cliente (criar ou editar)
  const handleSaveClient = async (clientData: ClientFormData, mode: 'create' | 'edit') => {
    console.log('🔄 handleSaveClient iniciado:', { clientData, mode });
    
    if (!session?.token) {
      console.error('❌ Sessão inválida');
      toast.error('Sessão inválida')
      return
    }

    try {
      if (mode === 'create') {
        console.log('🔄 Criando novo cliente...');
        
        // Criar novo cliente
        const createData: CreateClientData = {
          name: clientData.name,
          email: clientData.email,
          password: clientData.password || '',
          company: clientData.company,
          isActive: clientData.isActive ?? true
        }
        
        console.log('📤 Dados para criação:', createData);
        
        const result = await createClient(createData, session.token)
        console.log('✅ Cliente criado:', result);
        
        // Atualização otimista - adicionar cliente diretamente à lista
        const newClient: Client = {
          id: result.id,
          name: result.name,
          integratorId: result.integratorId,
          userId: result.userId,
          email: clientData.email,
          company: clientData.company,
          isActive: clientData.isActive ?? true,
          createdAt: result.createdAt || new Date().toISOString(),
          updatedAt: result.updatedAt || new Date().toISOString()
        }
        
        // Adicionar à lista local imediatamente
        setClients(prevClients => [newClient, ...prevClients])
        setFilteredClients(prevClients => [newClient, ...prevClients])
        
        toast.success('Cliente criado com sucesso!')
      } else {
        console.log('🔄 Editando cliente existente...');
        
        // Editar cliente existente
        const updateData: UpdateClientData = {
          name: clientData.name,
          email: clientData.email,
          company: clientData.company,
          isActive: clientData.isActive
        }
        
        if (clientData.password && clientData.password.trim() !== '') {
          updateData.password = clientData.password
        }
        
        const updatedClient = await updateClient(modalState.client!.id, updateData, session.token)
        
        // Atualização otimista - atualizar cliente na lista local
        const updateClientInList = (prevClients: Client[]) => 
          prevClients.map(client => 
            client.id === modalState.client!.id 
              ? { ...client, ...updatedClient, email: clientData.email } 
              : client
          )
        
        setClients(updateClientInList)
        setFilteredClients(updateClientInList)
        
        toast.success('Cliente atualizado com sucesso!')
      }
      
      // Fechar modal
      closeModal()
      console.log('✅ Processo concluído com sucesso');
      
      // Recarregar lista em background para sincronizar com servidor
      setTimeout(() => {
        loadClients()
      }, 1000)
      
    } catch (error) {
      console.error('❌ Erro ao salvar cliente:', error)
      toast.error(mode === 'create' ? 'Falha ao criar cliente' : 'Falha ao atualizar cliente')
    }
  }

  // Confirmar exclusão
  const handleDeleteClient = async (clientId: string) => {
    if (!session?.token) {
      toast.error('Sessão inválida')
      return
    }

    try {
      await deleteClient(clientId, session.token)
      
      // Atualização otimista - remover cliente da lista local imediatamente
      const removeClientFromList = (prevClients: Client[]) => 
        prevClients.filter(client => client.id !== clientId)
      
      setClients(removeClientFromList)
      setFilteredClients(removeClientFromList)
      
      toast.success('Cliente removido com sucesso!')
      setConfirmDelete(null)
      
      // Recarregar lista em background para sincronizar com servidor
      setTimeout(() => {
        loadClients()
      }, 1000)
      
    } catch (error) {
      console.error('Erro ao deletar cliente:', error)
      toast.error('Falha ao remover cliente')
    }
  }

  // Renderização condicional para permissões
  if (!isAdmin && !isIntegrator) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 force-dark-text">
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    )
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
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 force-dark-text">
        <p>{error}</p>
        <button 
          onClick={loadClients}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded text-sm"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="force-dark-text">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Clientes</h1>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
          onClick={openCreateModal}
        >
          <FiPlus className="mr-2" />
          Adicionar Cliente
        </button>
      </div>
      
      {/* Barra de pesquisa */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome..."
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Lista de clientes */}
      {filteredClients.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {searchTerm ? 'Nenhum cliente encontrado para a pesquisa.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data de Criação
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{client.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 font-mono">{client.id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(client)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar cliente"
                      >
                        <FiEdit2 />
                      </button>
                      
                      {confirmDelete === client.id ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-gray-600 hover:text-gray-900 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(client.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir cliente"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Informação sobre total de clientes */}
      <div className="mt-4 text-sm text-gray-500">
        Total: {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
        {searchTerm && ` (filtrado de ${clients.length})`}
      </div>

      {/* Modal para criar/editar cliente */}
      <ClientModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSave={handleSaveClient}
        client={modalState.client}
        mode={modalState.mode}
      />
    </div>
  )
} 
