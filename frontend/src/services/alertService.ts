/**
 * Serviço para operações relacionadas a alertas
 */

import { supabase } from '@/utils/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Tipos
export interface Alert {
  id: string;
  cameraId: string;
  status: 'NEW' | 'READ' | 'DISMISSED';
  type: 'MOTION' | 'OFFLINE' | 'MANUAL' | 'MOTION_DETECTED';
  message?: string;
  thumbnailUrl?: string;
  date: string;
  readAt?: string;
  camera?: {
    name: string;
    client?: {
      name: string;
    }
  };
}

export interface AlertsResponse {
  data: Alert[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AlertFilters {
  cameraId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface AlertStats {
  byStatus: { status: string, count: string }[];
  byType: { type: string, count: string }[];
  byDay: { day: string, count: string }[];
}

export interface AlertConfiguration {
  id: string;
  cameraId: string;
  emailAddresses: string[];
  notifyOnline: boolean;
  notifyOffline: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mapeia tipos de alerta do banco para a interface
 */
function mapAlertType(dbType: string): Alert['type'] {
  switch (dbType) {
    case 'MOTION_DETECTED':
      return 'MOTION';
    case 'CAMERA_OFFLINE':
      return 'OFFLINE';
    default:
      return dbType as Alert['type'];
  }
}

/**
 * Mapeia tipos de alerta da interface para o banco
 */
function mapAlertTypeToDb(interfaceType: Alert['type']): string {
  switch (interfaceType) {
    case 'MOTION':
      return 'MOTION_DETECTED';
    case 'OFFLINE':
      return 'CAMERA_OFFLINE';
    default:
      return interfaceType;
  }
}

/**
 * Busca alertas com filtros e paginação
 * @param filters Filtros (câmera, data inicial, final, status, tipo, página)
 * @param token Token JWT de autenticação
 * @returns Lista de alertas com metadados de paginação
 */
export async function fetchAlerts(
  filters: AlertFilters = {}, 
  token?: string
): Promise<AlertsResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/alerts`)
    
    // Aplicar filtros como parâmetros de query
    if (filters.status) {
      url.searchParams.append('status', filters.status)
    }
    if (filters.type) {
      url.searchParams.append('type', filters.type)
    }
    if (filters.startDate) {
      url.searchParams.append('startDate', filters.startDate)
    }
    if (filters.endDate) {
      url.searchParams.append('endDate', filters.endDate)
    }
    if (filters.cameraId) {
      url.searchParams.append('cameraId', filters.cameraId)
    }
    if (filters.page) {
      url.searchParams.append('page', filters.page.toString())
    }
    if (filters.limit) {
      url.searchParams.append('limit', filters.limit.toString())
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR')
      }
      if (response.status === 404) {
        // API não encontrada, retornar dados vazios silenciosamente
        console.warn('API de alertas não encontrada, retornando dados vazios')
        return {
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0
          }
        };
      }
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.warn('Serviço de alertas indisponível:', error);
    
    // Retornar estrutura vazia em caso de erro (fallback gracioso)
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      }
    };
  }
}

/**
 * Marca um alerta como lido
 * @param alertId ID do alerta
 * @param token Token JWT de autenticação
 * @returns Alerta atualizado
 */
export async function markAlertAsRead(alertId: string, token?: string): Promise<Alert> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Erro ao marcar alerta ${alertId} como lido:`, error);
    throw error;
  }
}

export async function createManualAlert(
  cameraId: string, 
  message: string, 
  token?: string
): Promise<Alert> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        cameraId,
        message,
        type: 'MANUAL',
        status: 'NEW'
      }),
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao criar alerta manual:', error);
    throw error;
  }
}

export async function deleteAlert(alertId: string, token?: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    return { success: true, message: 'Alerta excluído com sucesso' };
  } catch (error) {
    console.error(`Erro ao excluir alerta ${alertId}:`, error);
    throw error;
  }
}

export async function fetchAlertStats(token?: string): Promise<AlertStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
    })

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.warn('Estatísticas de alertas indisponíveis:', error);
    
    // Retornar dados vazios em caso de erro
    return {
      byStatus: [],
      byType: [],
      byDay: []
    };
  }
}

/**
 * Busca configurações de alerta para uma câmera
 * @param token Token JWT de autenticação
 * @param cameraId ID da câmera
 * @returns Lista de configurações de alerta
 */
export async function fetchAlertConfigurations(token: string, cameraId: string): Promise<AlertConfiguration[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/alert-configurations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR');
      }
      if (response.status === 404) {
        // API não encontrada, retornar dados vazios
        console.warn('API de configurações de alerta não encontrada, retornando dados vazios');
        return [];
      }
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Serviço de configurações de alerta indisponível:', error);
    // Retornar estrutura vazia em caso de erro (fallback gracioso)
    return [];
  }
}

/**
 * Cria uma nova configuração de alerta
 * @param configData Dados da configuração
 * @param token Token JWT de autenticação
 * @returns Configuração criada
 */
export async function createAlertConfiguration(
  configData: {
    cameraId: string;
    emailAddresses: string[];
    notifyOnline: boolean;
    notifyOffline: boolean;
  },
  token: string
): Promise<AlertConfiguration> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-configurations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar configuração de alerta:', error);
    throw error;
  }
}

/**
 * Atualiza uma configuração de alerta existente
 * @param configId ID da configuração
 * @param configData Dados atualizados
 * @param token Token JWT de autenticação
 * @returns Configuração atualizada
 */
export async function updateAlertConfiguration(
  configId: string,
  configData: Partial<{
    emailAddresses: string[];
    notifyOnline: boolean;
    notifyOffline: boolean;
    active: boolean;
  }>,
  token: string
): Promise<AlertConfiguration> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-configurations/${configId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erro ao atualizar configuração de alerta ${configId}:`, error);
    throw error;
  }
}

/**
 * Exclui uma configuração de alerta
 * @param configId ID da configuração
 * @param token Token JWT de autenticação
 * @returns Confirmação da exclusão
 */
export async function deleteAlertConfiguration(configId: string, token: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-configurations/${configId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`Erro ao excluir configuração de alerta ${configId}:`, error);
    throw error;
  }
} 