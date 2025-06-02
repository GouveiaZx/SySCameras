import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SessionManager } from '@/components/common/SessionManager'
import { Toaster } from 'react-hot-toast'

// Importar wrapper do console para filtrar warnings
import '@/utils/consoleWrapper'

export const metadata: Metadata = {
  title: 'Sistema de Monitoramento de Câmeras IP',
  description: 'Plataforma para monitoramento e gestão de câmeras IP em nuvem',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Suprimir warnings de extensões do navegador
            (function() {
              const originalWarn = console.warn;
              const originalError = console.error;
              
              console.warn = function(message, ...args) {
                if (typeof message === 'string') {
                  // Filtrar warnings de extensões
                  if (message.includes('bis_skin_checked') || 
                      message.includes('bis_register') ||
                      message.includes('__processed_') ||
                      message.includes('cz-shortcut-listen') ||
                      message.includes('Extra attributes from the server')) {
                    return; // Ignorar warnings de extensões
                  }
                }
                originalWarn.apply(console, [message, ...args]);
              };
              
              console.error = function(message, ...args) {
                if (typeof message === 'string') {
                  // Filtrar errors de extensões
                  if (message.includes('bis_skin_checked') || 
                      message.includes('bis_register') ||
                      message.includes('__processed_') ||
                      message.includes('cz-shortcut-listen') ||
                      message.includes('Extra attributes from the server')) {
                    return; // Ignorar errors de extensões
                  }
                }
                originalError.apply(console, [message, ...args]);
              };
            })();
          `
        }} />
      </head>
      <body>
        <AuthProvider>
          <SessionManager />
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#22c55e',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </body>
    </html>
  )
} 