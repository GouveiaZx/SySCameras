/**
 * Serviço para operações relacionadas a clientes - OTIMIZADO COM CACHE GLOBAL
 */

import { supabase } from '@/utils/supabase';

// Cache global único para todas as chamadas de clientes
let globalClientsCache: {
  data: Client[];
  timestamp: number;
} | null = null;

// Timeout para invalidar cache (5 minutos)
const CACHE_TIMEOUT = 5 * 60 * 1000;

// Debounce para evitar chamadas múltiplas
let debounceTimer: NodeJS.Timeout | null = null;

// Tipos
export interface Client {
  id: string;
  name: string;
  integratorId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientData {
  name: string;
  email: string;
  password: string;
  company?: string;
  isActive?: boolean;
}

export interface UpdateClientData {
  name?: string;
  email?: string;
  password?: string;
  company?: string;
  isActive?: boolean;
}

/**
 * Verifica se o cache está válido
 */
function isCacheValid(): boolean {
  if (!globalClientsCache) return false;
  const now = Date.now();
  return (now - globalClientsCache.timestamp) < CACHE_TIMEOUT;
}

/**
 * Invalida o cache de clientes
 */
export function invalidateClientsCache(): void {
  globalClientsCache = null;
  console.log('🗑️ Cache de clientes invalidado');
}

/**
 * Obtém a lista de clientes para o integrador atual - VERSÃO SIMPLIFICADA
 * @param token Token JWT de autenticação
 * @returns Lista de clientes
 */
export async function fetchClients(token: string): Promise<Client[]> {
  try {
    // Usar cache simples se válido
    if (isCacheValid()) {
      console.log('✅ Usando clientes do cache');
      return globalClientsCache!.data;
    }

    console.log('🔍 Buscando clientes do Supabase...');
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('❌ Erro do Supabase ao buscar clientes:', error);
      return [];
    }

    const clients = data || [];
    
    // Atualizar cache simples
    globalClientsCache = {
      data: clients,
      timestamp: Date.now()
    };

    console.log('✅ Clientes encontrados:', clients.length);
    return clients;
  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    return [];
  }
}

/**
 * Obtém um cliente específico por ID
 * @param clientId ID do cliente
 * @param token Token JWT de autenticação
 * @returns Dados do cliente
 */
export async function fetchClientById(clientId: string, token: string): Promise<Client> {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error('Erro ao buscar cliente:', error);
      throw new Error('Cliente não encontrado');
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar cliente por ID:', error);
    throw error;
  }
}

/**
 * Cria um novo cliente
 * @param clientData Dados do cliente
 * @param token Token JWT de autenticação
 * @returns Cliente criado
 */
export async function createClient(clientData: CreateClientData, token: string): Promise<Client> {
  try {
    // Primeiro criar o usuário na tabela users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        email: clientData.email,
        password: clientData.password, // Em produção, deveria ser hash
        role: 'client',
        isActive: clientData.isActive ?? true
      }])
      .select()
      .single();

    if (userError) {
      console.error('Erro ao criar usuário:', userError);
      throw new Error('Falha ao criar usuário');
    }

    // Depois criar o cliente
    const { data, error } = await supabase
      .from('clients')
      .insert([{
        name: clientData.name,
        userId: userData.id,
        integratorId: 'current-integrator-id', // TODO: obter do token
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cliente:', error);
      // Tentar limpar o usuário criado
      await supabase.from('users').delete().eq('id', userData.id);
      throw new Error('Falha ao criar cliente');
    }

    return data;
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    throw error;
  }
}

/**
 * Atualiza um cliente existente
 * @param clientId ID do cliente
 * @param clientData Dados atualizados
 * @param token Token JWT de autenticação
 * @returns Cliente atualizado
 */
export async function updateClient(clientId: string, clientData: UpdateClientData, token: string): Promise<Client> {
  try {
    // Primeiro obter o cliente atual para pegar o userId
    const currentClient = await fetchClientById(clientId, token);
    
    // Atualizar dados do usuário se necessário
    if (clientData.email || clientData.password || clientData.isActive !== undefined) {
      const userUpdateData: any = {};
      
      if (clientData.email) userUpdateData.email = clientData.email;
      if (clientData.password) userUpdateData.password = clientData.password;
      if (clientData.isActive !== undefined) userUpdateData.isActive = clientData.isActive;
      
      const { error: userError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', currentClient.userId);

      if (userError) {
        console.error('Erro ao atualizar usuário:', userError);
        throw new Error('Falha ao atualizar dados do usuário');
      }
    }

    // Atualizar dados do cliente
    const clientUpdateData: any = {
      updatedAt: new Date().toISOString()
    };
    
    if (clientData.name) clientUpdateData.name = clientData.name;

    const { data, error } = await supabase
      .from('clients')
      .update(clientUpdateData)
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw new Error('Falha ao atualizar cliente');
    }

    return data;
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    throw error;
  }
}

/**
 * Remove um cliente
 * @param clientId ID do cliente
 * @param token Token JWT de autenticação
 */
export async function deleteClient(clientId: string, token: string): Promise<void> {
  try {
    // Primeiro obter o cliente para pegar o userId
    const client = await fetchClientById(clientId, token);
    
    // Deletar o cliente
    const { error: clientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (clientError) {
      console.error('Erro ao deletar cliente:', clientError);
      throw new Error('Falha ao remover cliente');
    }

    // Deletar o usuário associado
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', client.userId);

    if (userError) {
      console.error('Erro ao deletar usuário:', userError);
      // Não falhar aqui pois o cliente já foi removido
    }
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    throw error;
  }
} 