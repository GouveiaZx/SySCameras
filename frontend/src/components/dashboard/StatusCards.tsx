'use client';

import { FC } from 'react';

type StatusCardsProps = {
  stats: {
    totalCameras: number;
    camerasOnline: number;
    camerasOffline: number;
    totalStorage: string;
    lastMotionDetection: string | null;
  };
};

const StatusCards: FC<StatusCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 force-dark-text">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-gray-900">Câmeras</h2>
            <div className="flex gap-2 text-sm text-gray-600">
              <p>Total: <span className="text-blue-600 font-semibold">{stats.totalCameras}</span></p>
              <p>Online: <span className="text-green-600 font-semibold">{stats.camerasOnline}</span></p>
              <p>Offline: <span className="text-red-600 font-semibold">{stats.camerasOffline}</span></p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-100 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-gray-900">Última Detecção</h2>
            <p className="text-sm text-gray-600">
              {stats.lastMotionDetection 
                ? stats.lastMotionDetection 
                : 'Nenhum movimento detectado recentemente'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-purple-100 text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-gray-900">Armazenamento</h2>
            <p className="text-sm text-gray-600">
              Em uso: <span className="text-purple-600 font-semibold">{stats.totalStorage}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusCards; 
