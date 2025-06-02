/**
 * Serviço para operações administrativas
 */

import { supabase } from '@/utils/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Tipos
export interface DashboardStats {
  totalCameras: number;
  totalAlerts: {
    total: number;
    new: number;
    read: number;
  };
  activeCameras: number;
  inactiveCameras: number;
  totalIntegrators: number;
  totalClients: number;
  totalRecordings: number;
  storageUsed: {
    total: number;
    percentage: number;
  };
}

export interface Integrator {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  clientsCount?: number;
  camerasCount?: number;
  userId?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  status: 'active' | 'inactive';
  integratorId?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
  integrator?: {
    name: string;
  };
}

/**
 * Busca estatísticas do dashboard administrativo
 * @param token Token JWT de autenticação
 * @returns Estatísticas do dashboard
 */
export async function fetchDashboardStats(token: string): Promise<DashboardStats> {
  try {
    console.log('🔄 Tentando buscar stats do dashboard...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Resposta da API stats:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erro na API stats:', errorText);
      
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR');
      }
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Stats carregadas com sucesso');
    return data;
  } catch (error) {
    console.warn('Estatísticas administrativas indisponíveis:', error);
    
    // Retornar dados zerados em caso de erro
    return {
      totalCameras: 0,
      totalAlerts: {
        total: 0,
        new: 0,
        read: 0
      },
      activeCameras: 0,
      inactiveCameras: 0,
      totalIntegrators: 0,
      totalClients: 0,
      totalRecordings: 0,
      storageUsed: {
        total: 0,
        percentage: 0
      }
    };
  }
}

/**
 * Busca lista de integradores
 * @param token Token JWT de autenticação
 * @returns Lista de integradores
 */
export async function fetchIntegrators(token: string): Promise<Integrator[]> {
  try {
    console.log('🔄 Tentando buscar integradores...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/integrators`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('👥 Resposta da API integradores:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erro na API integradores:', errorText);
      
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR');
      }
      console.warn(`API de integradores não disponível: ${response.status}`);
      return []; // Retornar array vazio em caso de erro
    }

    const data = await response.json();
    console.log('✅ Integradores carregados com sucesso');
    return data.data || data; // Suportar diferentes formatos de resposta
  } catch (error) {
    console.warn('Erro ao buscar integradores:', error);
    return []; // Retornar array vazio em caso de erro
  }
}

/**
 * Busca lista de clientes
 * @param token Token JWT de autenticação
 * @returns Lista de clientes
 */
export async function fetchClients(token: string): Promise<Client[]> {
  try {
    // Usar Supabase diretamente para buscar clientes
    const { data: clients, error } = await (await import('@/utils/supabase')).supabase
      .from('clients')
      .select(`
        id,
        name,
        userId,
        integratorId,
        createdAt,
        users!inner (
          email,
          createdAt,
          active
        ),
        integrators (
          name
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar clientes via Supabase:', error);
      return [];
    }

    // Formatar dados para o formato esperado
    return (clients || []).map((client: any) => ({
      id: client.id,
      name: client.name,
      email: client.users?.email || '',
      company: '',
      phone: '',
      status: client.users?.active ? 'active' : 'inactive',
      integratorId: client.integratorId,
      createdAt: client.users?.createdAt || client.createdAt || new Date().toISOString(),
      user: {
        name: client.name,
        email: client.users?.email || ''
      },
      integrator: client.integrators ? {
        name: client.integrators.name
      } : undefined
    }));
  } catch (error) {
    console.warn('Erro ao buscar clientes:', error);
    return []; // Retornar array vazio em caso de erro
  }
}

/**
 * Cria um novo integrador
 * @param integratorData Dados do integrador
 * @param token Token JWT de autenticação
 * @returns Integrador criado
 */
export async function createIntegrator(integratorData: Partial<Integrator>, token: string): Promise<Integrator> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/integrators`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(integratorData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar integrador:', error);
    throw error;
  }
}

/**
 * Cria um novo cliente
 * @param clientData Dados do cliente
 * @param token Token JWT de autenticação
 * @returns Cliente criado
 */
export async function createClient(clientData: Partial<Client>, token: string): Promise<Client> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    throw error;
  }
}

/**
 * Atualiza status de um integrador
 * @param integratorId ID do integrador
 * @param status Novo status
 * @param token Token JWT de autenticação
 * @returns Integrador atualizado
 */
export async function updateIntegratorStatus(
  integratorId: string, 
  status: 'active' | 'inactive', 
  token: string
): Promise<Integrator> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/integrators/${integratorId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao atualizar status do integrador:', error);
    throw error;
  }
}

/**
 * Atualiza status de um cliente
 * @param clientId ID do cliente
 * @param status Novo status
 * @param token Token JWT de autenticação
 * @returns Cliente atualizado
 */
export async function updateClientStatus(
  clientId: string, 
  status: 'active' | 'inactive', 
  token: string
): Promise<Client> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/clients/${clientId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao atualizar status do cliente:', error);
    throw error;
  }
}

/**
 * Testa a autenticação com o backend
 * @param token Token JWT de autenticação
 * @returns Resultado do teste
 */
export async function testAuthentication(token: string): Promise<any> {
  try {
    console.log('🧪 Testando autenticação com backend...');
    console.log('🎫 Token (primeiros 20 chars):', token.substring(0, 20) + '...');
    
    const response = await fetch(`${API_BASE_URL}/api/test-auth`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Resposta do teste de auth:', response.status);

    const data = await response.json();
    console.log('📋 Dados da resposta:', data);

    return data;
  } catch (error) {
    console.error('❌ Erro no teste de autenticação:', error);
    throw error;
  }
} 