import { supabase } from '@/utils/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Classe para gerenciar chamadas à API
 */
class ApiService {
  private token: string | null = null;

  /**
   * Define o token de autenticação para todas as requisições futuras
   * @param token Token JWT
   */
  setToken(token: string) {
    this.token = token;
  }

  /**
   * Limpa o token de autenticação
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Realiza uma requisição à API
   * @param endpoint Endpoint da API
   * @param options Opções da requisição
   * @returns Resposta da requisição
   */
  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Erro na requisição: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Obtém estatísticas gerais do sistema
   * @returns Estatísticas do sistema
   */
  async getDashboardStats() {
    return this.fetch<{
      totalCameras: number;
      camerasOnline: number;
      camerasOffline: number;
      totalStorage: string;
      lastMotionDetection: string | null;
    }>('/stats/dashboard');
  }

  /**
   * Obtém a lista de câmeras
   * @returns Lista de câmeras
   */
  async getCameras() {
    return this.fetch<any[]>('/cameras');
  }

  /**
   * Obtém detalhes de uma câmera
   * @param id ID da câmera
   * @returns Detalhes da câmera
   */
  async getCamera(id: string) {
    return this.fetch<any>(`/cameras/${id}`);
  }

  /**
   * Obtém a lista de gravações
   * @param params Parâmetros de filtragem
   * @returns Lista de gravações
   */
  async getRecordings(params?: { cameraId?: string; startDate?: string; endDate?: string }) {
    const queryParams = new URLSearchParams();
    
    if (params?.cameraId) {
      queryParams.append('cameraId', params.cameraId);
    }
    
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.fetch<any[]>(`/recordings${query}`);
  }

  /**
   * Obtém a configuração de detecção de movimento de uma câmera
   * @param cameraId ID da câmera
   * @returns Configuração de detecção de movimento
   */
  async getMotionDetectionConfig(cameraId: string) {
    return this.fetch<any>(`/cameras/${cameraId}/motion-detection`);
  }

  /**
   * Salva a configuração de detecção de movimento de uma câmera
   * @param cameraId ID da câmera
   * @param config Configuração de detecção de movimento
   * @returns Configuração salva
   */
  async saveMotionDetectionConfig(cameraId: string, config: any) {
    return this.fetch(`/cameras/${cameraId}/motion-detection`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  /**
   * Obtém a lista de agendamentos de gravação de uma câmera
   * @param cameraId ID da câmera
   * @returns Lista de agendamentos
   */
  async getRecordingSchedules(cameraId: string) {
    return this.fetch<any[]>(`/cameras/${cameraId}/schedules`);
  }

  /**
   * Cria um novo agendamento de gravação
   * @param cameraId ID da câmera
   * @param schedule Dados do agendamento
   * @returns Agendamento criado
   */
  async createRecordingSchedule(cameraId: string, schedule: any) {
    return this.fetch(`/cameras/${cameraId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(schedule)
    });
  }

  /**
   * Atualiza um agendamento de gravação
   * @param scheduleId ID do agendamento
   * @param schedule Dados do agendamento
   * @returns Agendamento atualizado
   */
  async updateRecordingSchedule(scheduleId: string, schedule: any) {
    return this.fetch(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(schedule)
    });
  }

  /**
   * Remove um agendamento de gravação
   * @param scheduleId ID do agendamento
   */
  async deleteRecordingSchedule(scheduleId: string) {
    return this.fetch(`/schedules/${scheduleId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Obtém estatísticas de uso do armazenamento
   * @returns Estatísticas de armazenamento
   */
  async getStorageStats() {
    return this.fetch<{ totalUsed: string, byCamera: any[] }>('/stats/storage');
  }

  /**
   * Obtém dados dos integradores
   * @returns Lista de integradores
   */
  async getIntegrators() {
    return this.fetch<any[]>('/integrators');
  }

  /**
   * Obtém dados dos clientes
   * @returns Lista de clientes
   */
  async getClients() {
    return this.fetch<any[]>('/clients');
  }
}

const api = new ApiService();

export default api; 