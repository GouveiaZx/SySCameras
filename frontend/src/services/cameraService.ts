/**
 * Serviço para operações relacionadas a câmeras
 */

import { supabase } from '@/utils/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Tipos
export interface Camera {
  id: string;
  name: string;
  rtspUrl?: string;
  rtmpUrl?: string;
  hlsUrl?: string;
  location?: string;
  status: 'online' | 'offline' | 'maintenance';
  streamStatus?: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  recordingStatus?: 'CONTINUOUS' | 'INACTIVE' | 'MANUAL' | 'MOTION' | 'SCHEDULED';
  type: 'IP' | 'ANALOG';
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  integratorId?: string;
  client?: {
    id: string;
    name: string;
  };
  integrator?: {
    id: string;
    name: string;
  };
  retention_settings?: {
    id: string;
    days: number;
    cameraId: string;
    createdAt: string;
    updatedAt: string;
  };
  // Alias para compatibilidade
  retention?: {
    days: number;
  };
}

// Cache das câmeras para melhorar performance
let camerasCache: Camera[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 segundos

/**
 * Invalida o cache de câmeras
 */
export function invalidateCamerasCache(): void {
  camerasCache = null;
  cacheTimestamp = 0;
}

/**
 * Busca câmeras com cache
 * @param token Token JWT de autenticação
 * @returns Lista de câmeras
 */
export async function fetchCameras(token: string): Promise<Camera[]> {
  try {
    // Verificar cache válido
    const now = Date.now();
    if (camerasCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return camerasCache;
    }

    const response = await fetch(`${API_BASE_URL}/api/cameras`, {
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
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Atualizar cache
    camerasCache = data;
    cacheTimestamp = now;
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar câmeras:', error);
    throw error;
  }
}

/**
 * Busca uma câmera específica por ID
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Dados da câmera
 */
export async function fetchCameraById(cameraId: string, token: string): Promise<Camera> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Câmera não encontrada');
      }
      if (response.status === 401) {
        throw new Error('AUTHENTICATION_ERROR');
      }
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Mapear retention_settings para retention para compatibilidade
    if (data.retention_settings && !data.retention) {
      data.retention = {
        days: data.retention_settings.days
      };
    }
    
    return data;
  } catch (error) {
    console.error(`Erro ao buscar câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Cria uma nova câmera
 * @param cameraData Dados da câmera
 * @param token Token JWT de autenticação
 * @returns Câmera criada
 */
export async function createCamera(cameraData: Partial<Camera>, token: string): Promise<Camera> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cameraData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Invalidar cache
    invalidateCamerasCache();
    
    return data;
  } catch (error) {
    console.error('Erro ao criar câmera:', error);
    throw error;
  }
}

/**
 * Atualiza uma câmera existente
 * @param cameraId ID da câmera
 * @param cameraData Dados atualizados
 * @param token Token JWT de autenticação
 * @returns Câmera atualizada
 */
export async function updateCamera(cameraId: string, cameraData: Partial<Camera>, token: string): Promise<Camera> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cameraData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Invalidar cache
    invalidateCamerasCache();
    
    return data;
  } catch (error) {
    console.error(`Erro ao atualizar câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Exclui uma câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Confirmação da exclusão
 */
export async function deleteCamera(cameraId: string, token: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}`, {
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

    // Invalidar cache
    invalidateCamerasCache();
    
    return { success: true };
  } catch (error) {
    console.error(`Erro ao excluir câmera ${cameraId}:`, error);
    throw error;
  }
}

/**
 * Inicia o streaming de uma câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function startCameraStream(cameraId: string, token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stream/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cameraId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Invalidar cache para refletir mudanças
    invalidateCamerasCache();
    
    return data;
  } catch (error) {
    console.error('Erro ao iniciar streaming:', error);
    throw error;
  }
}

/**
 * Para o streaming de uma câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns Resultado da operação
 */
export async function stopCameraStream(cameraId: string, token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stream/stop`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cameraId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    // Invalidar cache para refletir mudanças
    invalidateCamerasCache();
    
    return data;
  } catch (error) {
    console.error('Erro ao parar streaming:', error);
    throw error;
  }
}

/**
 * Captura um snapshot da câmera
 * @param cameraId ID da câmera
 * @param token Token JWT de autenticação
 * @returns URL do snapshot
 */
export async function captureSnapshot(cameraId: string, token: string): Promise<{ snapshotUrl: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/snapshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao capturar snapshot:', error);
    throw error;
  }
}

export async function checkCameraStatus(id: string, token: string): Promise<any> {
  console.log('🔍 Iniciando verificação de status da câmera:', id);
  console.log('🔑 Token disponível:', !!token);
  
  try {
    const url = `${API_BASE_URL}/api/cameras/${id}/check-status`;
    console.log('📡 URL da requisição:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📊 Status text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na resposta:', errorText);
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Resultado da verificação:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Erro na função checkCameraStatus:', error);
    throw error;
  }
} 