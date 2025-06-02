'use client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  size = 'md', 
  message = 'Carregando...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }
  
  const containerClasses = fullScreen 
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    : 'flex items-center justify-center py-8'

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mx-auto ${sizeClasses[size]}`}></div>
        {message && (
          <p className={`mt-2 text-gray-600 ${fullScreen ? 'text-white' : ''}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
} 