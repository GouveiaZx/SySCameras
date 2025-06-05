/**
 * Serviço para operações administrativas
 */

import { supabase } from '@/utils/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

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

export interface IntegratorFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  createdAfter?: string;
  createdBefore?: string;
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

export interface SystemStats {
  totalIntegrators: number;
  totalClients: number;
  totalCameras: number;
  activeCameras: number;
  inactiveCameras: number;
  totalRecordings: number;
  totalAlerts: {
    total: number;
    new: number;
    read: number;
  };
  storageUsed: {
    total: number;
    percentage: number;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface StatsOverTime {
  date: string;
  count: number;
  label?: string;
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
 * @param filters Filtros para a busca
 * @param token Token JWT de autenticação
 * @returns Lista de integradores
 */
export async function fetchIntegrators(filters: IntegratorFilters = {}, token: string): Promise<{ data: Integrator[], meta: { totalPages: number } }> {
  try {
    console.log('🔄 Tentando buscar integradores...');
    
    // Construir query params
    const queryParams = new URLSearchParams();
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    
    const url = `${API_BASE_URL}/api/admin/integrators${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    const response = await fetch(url, {
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
      return { data: [], meta: { totalPages: 1 } }; // Retornar estrutura esperada em caso de erro
    }

    const data = await response.json();
    console.log('✅ Integradores carregados com sucesso');
    
    // Garantir que retornamos a estrutura esperada
    if (data.data && data.meta) {
      return data;
    } else {
      // Se a API não retornar meta, criar uma estrutura padrão
      return {
        data: Array.isArray(data) ? data : (data.data || []),
        meta: { totalPages: 1 }
      };
    }
  } catch (error) {
    console.warn('Erro ao buscar integradores:', error);
    return { data: [], meta: { totalPages: 1 } }; // Retornar estrutura esperada em caso de erro
  }
}

/**
 * Busca lista de clientes
 * @param token Token JWT de autenticação
 * @returns Lista de clientes
 */
export async function fetchClients(token: string): Promise<Client[]> {
  try {
    // Usar Supabase diretamente para buscar clientes da tabela real
    const { data: clients, error } = await (await import('@/utils/supabase')).supabase
      .from('clients_real')
      .select(`
        id,
        name,
        "userId",
        "integratorId",
        "createdAt",
        company,
        users!inner (
          email,
          createdAt,
          isActive
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
      company: client.company || '',
      phone: '',
      status: client.users?.isActive ? 'active' : 'inactive',
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
 * Atualiza um integrador existente
 * @param integratorId ID do integrador
 * @param integratorData Dados do integrador
 * @param token Token JWT de autenticação
 * @returns Integrador atualizado
 */
export async function updateIntegrator(integratorId: string, integratorData: Partial<Integrator>, token: string): Promise<Integrator> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/integrators/${integratorId}`, {
      method: 'PUT',
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
    console.error('Erro ao atualizar integrador:', error);
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

/**
 * Busca estatísticas do sistema
 * @param token Token JWT de autenticação
 * @returns Estatísticas do sistema
 */
export async function fetchSystemStats(token: string): Promise<SystemStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats/system`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar estatísticas do sistema:', error);
    // Retornar estrutura vazia em caso de erro
    return {
      totalIntegrators: 0,
      totalClients: 0,
      totalCameras: 0,
      activeCameras: 0,
      inactiveCameras: 0,
      totalRecordings: 0,
      totalAlerts: {
        total: 0,
        new: 0,
        read: 0,
      },
      storageUsed: {
        total: 0,
        percentage: 0,
      },
    };
  }
}

/**
 * Busca atividades recentes
 * @param token Token JWT de autenticação
 * @param limit Limite de resultados
 * @returns Atividades recentes
 */
export async function fetchRecentActivities(token: string, limit: number = 10): Promise<ActivityItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/activities/recent?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar atividades recentes:', error);
    return [];
  }
}

/**
 * Busca gravações ao longo do tempo
 * @param token Token JWT de autenticação
 * @param period Período (day, week, month)
 * @returns Dados de gravações
 */
export async function fetchRecordingsOverTime(token: string, period: 'day' | 'week' | 'month' = 'week'): Promise<StatsOverTime[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats/recordings?period=${period}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar dados de gravações:', error);
    return [];
  }
}

/**
 * Busca alertas ao longo do tempo
 * @param token Token JWT de autenticação
 * @param period Período (day, week, month)
 * @returns Dados de alertas
 */
export async function fetchAlertsOverTime(token: string, period: 'day' | 'week' | 'month' = 'week'): Promise<StatsOverTime[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats/alerts?period=${period}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar dados de alertas:', error);
    return [];
  }
} 
