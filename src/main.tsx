import React from 'react'
import ReactDOM from 'react-dom/client'
import InvestorCabinetV2Lab from './v2/InvestorCabinetV2Lab'
import { AuthProvider } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import './components/errorBoundary.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <InvestorCabinetV2Lab />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
