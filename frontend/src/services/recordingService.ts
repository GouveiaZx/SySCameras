/**
 * Serviço para operações relacionadas a gravações - OTIMIZADO COM CACHE
 */

import { supabase } from '@/utils/supabase';

// Cache global para gravações
let globalRecordingsCache: {
  data: Record<string, RecordingsResponse>; // Indexado por cameraId + filtros
  timestamp: Record<string, number>;
  promises: Record<string, Promise<RecordingsResponse>>;
} = {
  data: {},
  timestamp: {},
  promises: {}
};

// Timeout para invalidar cache (3 minutos para gravações)
const CACHE_TIMEOUT = 3 * 60 * 1000;

// Tipos
export interface Recording {
  id: string;
  filename: string;
  url: string;
  date: string;
  duration: number;
  size: number;
  cameraId: string;
  recordingType: 'MANUAL' | 'MOTION' | 'SCHEDULED' | 'CONTINUOUS';
  triggerEvent?: string;
  createdAt: string;
}

export interface RecordingsResponse {
  data: Recording[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RecordingFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
  page?: number;
  limit?: number;
}

// Invalidar cache existente ao inicializar
invalidateRecordingsCache();

/**
 * Gera chave de cache com base nos parâmetros
 */
function getCacheKey(cameraId: string, filters: RecordingFilters): string {
  return `${cameraId}_${JSON.stringify(filters)}`;
}

/**
 * Verifica se o cache está válido
 */
function isCacheValid(cacheKey: string): boolean {
  if (!globalRecordingsCache.timestamp[cacheKey]) return false;
  const now = Date.now();
  return (now - globalRecordingsCache.timestamp[cacheKey]) < CACHE_TIMEOUT;
}

/**
 * Invalida o cache de gravações para uma câmera
 */
export function invalidateRecordingsCache(cameraId?: string): void {
  if (cameraId) {
    // Limpar cache específico de uma câmera
    Object.keys(globalRecordingsCache.data).forEach(key => {
      if (key.startsWith(cameraId)) {
        delete globalRecordingsCache.data[key];
        delete globalRecordingsCache.timestamp[key];
        delete globalRecordingsCache.promises[key];
      }
    });
    console.log(`🗑️ Cache de gravações da câmera ${cameraId} invalidado`);
  } else {
    // Limpar todo o cache
    globalRecordingsCache = { data: {}, timestamp: {}, promises: {} };
    console.log('🗑️ Cache de gravações completamente invalidado');
  }
}

/**
 * Busca gravações de uma câmera com filtros e paginação - OTIMIZADA
 * @param cameraId ID da câmera
 * @param filters Filtros (data inicial, final, tipo, página)
 * @param token Token JWT de autenticação
 * @returns Lista de gravações com metadados de paginação
 */
export async function fetchRecordings(
  cameraId: string, 
  filters: RecordingFilters = {}, 
  token: string
): Promise<RecordingsResponse> {
  try {
    const cacheKey = getCacheKey(cameraId, filters);
    
    // Se já existe uma chamada em andamento, aguardar ela
    if (globalRecordingsCache.promises[cacheKey] !== undefined) {
      console.log('⏳ Aguardando chamada de gravações existente...');
      return await globalRecordingsCache.promises[cacheKey];
    }

    // Usar cache se válido
    if (isCacheValid(cacheKey)) {
      console.log('✅ Usando gravações do cache');
      return globalRecordingsCache.data[cacheKey];
    }

    // Criar promise e armazenar no cache
    const fetchPromise = (async (): Promise<RecordingsResponse> => {
      try {
        console.log('🔍 Buscando gravações para câmera:', cameraId);
        
        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
          .from('recordings')
          .select('*', { count: 'exact' })
          .eq('cameraId', cameraId)
          .order('createdAt', { ascending: false })
          .range(from, to);

        // Aplicar filtros de data
        if (filters.startDate) {
          query = query.gte('date', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('date', filters.endDate);
        }
        if (filters.type) {
          query = query.eq('recordingType', filters.type);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('❌ Erro do Supabase ao buscar gravações:', error);
          throw new Error('Erro ao buscar gravações');
        }

        const totalPages = Math.ceil((count || 0) / limit);
        const result: RecordingsResponse = {
          data: data || [],
          meta: {
            total: count || 0,
            page,
            limit,
            totalPages
          }
        };

        // Armazenar no cache
        globalRecordingsCache.data[cacheKey] = result;
        globalRecordingsCache.timestamp[cacheKey] = Date.now();
        delete globalRecordingsCache.promises[cacheKey];

        console.log('✅ Gravações encontradas:', result.data.length);
        return result;
      } catch (error) {
        // Limpar promise em caso de erro
        delete globalRecordingsCache.promises[cacheKey];
        console.error(`❌ Erro ao buscar gravações para câmera ${cameraId}:`, error);
        // Retornar dados vazios ao invés de erro para não quebrar a UI
        return {
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0
          }
        };
      }
    })();

    // Armazenar promise no cache
    globalRecordingsCache.promises[cacheKey] = fetchPromise;

    return await fetchPromise;
  } catch (error) {
    console.error(`❌ Erro ao buscar gravações para câmera ${cameraId}:`, error);
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      }
    };
  }
}

/**
 * Inicia gravação contínua para uma câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function startContinuousRecording(cameraId: string, token: string): Promise<any> {
  try {
    console.log('🎬 Iniciando gravação contínua para câmera:', cameraId);
    
    const response = await fetch(`/api/cameras/${cameraId}/recording/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao iniciar gravação contínua');
    }

    const data = await response.json();
    console.log('✅ Gravação contínua iniciada com sucesso');
    
    // Invalidar cache de gravações desta câmera
    invalidateRecordingsCache(cameraId);
    
    return data;
  } catch (error) {
    console.error(`Erro ao iniciar gravação contínua para câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Para gravação contínua de uma câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function stopContinuousRecording(cameraId: string, token: string): Promise<any> {
  try {
    console.log('🛑 Parando gravação contínua para câmera:', cameraId);
    
    const response = await fetch(`/api/cameras/${cameraId}/recording/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao parar gravação contínua');
    }

    const data = await response.json();
    console.log('✅ Gravação contínua parada com sucesso');
    
    // Invalidar cache de gravações desta câmera
    invalidateRecordingsCache(cameraId);
    
    return data;
  } catch (error) {
    console.error(`Erro ao parar gravação contínua para câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Exclui uma gravação
 * @param recordingId ID da gravação
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function deleteRecording(recordingId: string, token: string): Promise<any> {
  try {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', recordingId);

    if (error) {
      throw new Error('Erro ao excluir gravação');
    }

    return { success: true, message: 'Gravação excluída com sucesso' };
  } catch (error) {
    console.error(`Erro ao excluir gravação ${recordingId}:`, error);
    throw error;
  }
}

/**
 * Inicia limpeza de gravações antigas (apenas para administradores)
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function cleanupOldRecordings(token: string): Promise<any> {
  try {
    console.log('🧹 Iniciando limpeza de gravações antigas');
    
    const response = await fetch('/api/recordings/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao iniciar limpeza de gravações');
    }

    const data = await response.json();
    console.log('✅ Limpeza de gravações iniciada com sucesso');
    
    return data;
  } catch (error) {
    console.error('Erro ao limpar gravações antigas:', error);
    throw error;
  }
}

/**
 * Atualiza as configurações de retenção de uma câmera
 * @param cameraId ID da câmera
 * @param days Número de dias para retenção
 * @param token Token JWT de autenticação
 * @returns Dados da configuração atualizada
 */
export async function updateRetentionSetting(
  cameraId: string, 
  days: number, 
  token: string
): Promise<any> {
  try {
    console.log(`🗃️ Atualizando retenção para câmera ${cameraId}: ${days} dias`);
    
    const response = await fetch(`/api/cameras/${cameraId}/retention`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ days })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao atualizar configuração de retenção');
    }

    const data = await response.json();
    console.log('✅ Configuração de retenção atualizada com sucesso');
    
    // Invalidar cache de gravações desta câmera
    invalidateRecordingsCache(cameraId);
    
    return data;
  } catch (error) {
    console.error(`❌ Erro ao atualizar retenção da câmera ${cameraId}:`, error);
    throw error;
  }
} 
