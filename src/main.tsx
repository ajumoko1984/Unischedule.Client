import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            },
            success: { iconTheme: { primary: '#2563eb', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
