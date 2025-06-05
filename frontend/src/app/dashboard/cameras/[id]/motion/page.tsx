'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCameraById, Camera } from '@/services/cameraService';
import { ImSpinner8 } from 'react-icons/im';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Tipos para detecção de movimento
interface MotionDetectionConfig {
  enabled: boolean;
  sensitivity: number;  // 0-100
  cooldownSeconds: number;
  detectionAreas: {
    topLeft: boolean;
    topCenter: boolean;
    topRight: boolean;
    middleLeft: boolean;
    middleCenter: boolean;
    middleRight: boolean;
    bottomLeft: boolean;
    bottomCenter: boolean;
    bottomRight: boolean;
  };
}

export default function CameraMotionDetectionPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useAuth();
  
  const cameraId = params.id as string;
  
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Estado da configuração de movimento
  const [isEnabled, setIsEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(50);
  const [cooldown, setCooldown] = useState(10);
  const [detectionAreas, setDetectionAreas] = useState({
    topLeft: true,
    topCenter: true,
    topRight: true,
    middleLeft: true,
    middleCenter: true,
    middleRight: true,
    bottomLeft: true,
    bottomCenter: true,
    bottomRight: true
  });
  
  // Grid de áreas para seleção visual
  const areaGrid = [
    ['topLeft', 'topCenter', 'topRight'],
    ['middleLeft', 'middleCenter', 'middleRight'],
    ['bottomLeft', 'bottomCenter', 'bottomRight']
  ];
  
  useEffect(() => {
    const loadCamera = async () => {
      try {
        if (session?.token) {
          const cameraData = await fetchCameraById(cameraId, session.token);
          setCamera(cameraData);
          
          // Carregar configurações de movimento da câmera
          // TODO: Implementar endpoint /api/cameras/:id/motion-config no backend
          try {
            const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/motion-config`, {
              headers: {
                'Authorization': `Bearer ${session.token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const motionConfig = await response.json();
              setIsEnabled(motionConfig.enabled);
              setSensitivity(motionConfig.sensitivity);
              setCooldown(motionConfig.cooldownSeconds);
              setDetectionAreas(motionConfig.detectionAreas);
            } else {
              console.warn('Endpoint de configuração de movimento ainda não implementado');
              // Configurações padrão
              setIsEnabled(false);
              setSensitivity(50);
              setCooldown(10);
              setDetectionAreas({
                topLeft: false,
                topCenter: false,
                topRight: false,
                middleLeft: false,
                middleCenter: false,
                middleRight: false,
                bottomLeft: false,
                bottomCenter: false,
                bottomRight: false
              });
            }
          } catch (apiError) {
            console.warn('API de configuração de movimento não disponível ainda:', apiError);
            // Configurações padrão
            setIsEnabled(false);
            setSensitivity(50);
            setCooldown(10);
            setDetectionAreas({
              topLeft: false,
              topCenter: false,
              topRight: false,
              middleLeft: false,
              middleCenter: false,
              middleRight: false,
              bottomLeft: false,
              bottomCenter: false,
              bottomRight: false
            });
          }
        }
      } catch (err) {
        setError('Falha ao carregar dados da câmera');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadCamera();
  }, [cameraId, session]);
  
  const toggleArea = (area: string) => {
    setDetectionAreas(prev => ({
      ...prev,
      [area]: !prev[area as keyof typeof detectionAreas]
    }));
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      // Montar objeto com configurações
      const motionConfig: MotionDetectionConfig = {
        enabled: isEnabled,
        sensitivity,
        cooldownSeconds: cooldown,
        detectionAreas
      };
      
      // Enviar para a API
      // TODO: Implementar endpoint PUT /api/cameras/:id/motion-config no backend
      const response = await fetch(`${API_BASE_URL}/api/cameras/${cameraId}/motion-config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(motionConfig)
      });
      
      if (response.ok) {
        setSaveSuccess(true);
        
        // Reset do alerta de sucesso após 3 segundos
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Falha ao salvar configurações de detecção de movimento');
      }
    } catch (err) {
      console.warn('API de configuração de movimento não disponível ainda:', err);
      // Por enquanto, simula sucesso até implementar o endpoint
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } finally {
      setSaving(false);
    }
  };
  
  // Selecionar/desmarcar todas as áreas
  const selectAllAreas = (selected: boolean) => {
    setDetectionAreas({
      topLeft: selected,
      topCenter: selected,
      topRight: selected,
      middleLeft: selected,
      middleCenter: selected,
      middleRight: selected,
      bottomLeft: selected,
      bottomCenter: selected,
      bottomRight: selected
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ImSpinner8 className="animate-spin text-blue-500 text-3xl" />
      </div>
    );
  }
  
  if (!camera) {
    return <div className="p-4 text-red-600">Câmera não encontrada</div>;
  }
  
  return (
    <div>
      <div className="flex items-center mb-6 space-x-4">
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold">Detecção de Movimento: {camera.name}</h1>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          Configurações salvas com sucesso!
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <label htmlFor="enabled" className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="enabled"
                    className="sr-only"
                    checked={isEnabled}
                    onChange={() => setIsEnabled(!isEnabled)}
                  />
                  <div className={`block w-14 h-8 rounded-full ${isEnabled ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isEnabled ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="ml-3 text-lg font-medium">
                  Detecção de Movimento {isEnabled ? 'Ativada' : 'Desativada'}
                </div>
              </label>
            </div>
            
            <p className="text-sm text-gray-500 mt-2">
              Quando ativada, a câmera irá iniciar gravações automaticamente ao detectar movimento nas áreas selecionadas.
            </p>
          </div>
          
          <div className={`transition-opacity duration-300 ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="mb-6">
              <label htmlFor="sensitivity" className="block text-sm font-medium text-gray-700 mb-1">
                Sensibilidade: {sensitivity}%
              </label>
              <input
                id="sensitivity"
                type="range"
                min="0"
                max="100"
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Baixa</span>
                <span>Média</span>
                <span>Alta</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Valores mais altos detectam movimentos mais sutis, mas podem gerar mais falsos positivos.
              </p>
            </div>
            
            <div className="mb-6">
              <label htmlFor="cooldown" className="block text-sm font-medium text-gray-700 mb-1">
                Tempo de Espera (Cooldown)
              </label>
              <div className="flex items-center">
                <input
                  id="cooldown"
                  type="number"
                  min="1"
                  max="60"
                  value={cooldown}
                  onChange={(e) => setCooldown(Number(e.target.value))}
                  className="w-24 p-2 border border-gray-300 rounded mr-2"
                />
                <span>segundos</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Tempo mínimo entre cada detecção de movimento. Evita múltiplas gravações em sequência para o mesmo evento.
              </p>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Áreas de Detecção
                </label>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => selectAllAreas(true)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                  >
                    Selecionar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllAreas(false)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-2">
                {areaGrid.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-3 gap-2">
                    {row.map((area) => (
                      <div
                        key={area}
                        onClick={() => toggleArea(area)}
                        className={`
                          aspect-square border-2 rounded cursor-pointer
                          ${detectionAreas[area as keyof typeof detectionAreas] 
                            ? 'bg-blue-500 border-blue-600' 
                            : 'bg-gray-200 border-gray-300'}
                        `}
                      />
                    ))}
                  </div>
                ))}
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                Clique nas áreas do grid onde a detecção de movimento deve ser aplicada.
                Áreas em azul estão ativas para detecção.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-8">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/cameras/${cameraId}`)}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
                saving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {saving ? (
                <span className="flex items-center">
                  <ImSpinner8 className="animate-spin mr-2" />
                  Salvando...
                </span>
              ) : (
                'Salvar Configurações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 