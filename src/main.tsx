import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import InvestorCabinetV2Lab from './v2/InvestorCabinetV2Lab'
import './App.css'

// Две рабочие версии:
//  — основной сайт «с мозгом» (App) на «/»
//  — витрина нового визуала на «/v2-lab» (или #v2-lab)
const isV2Lab =
  window.location.pathname.startsWith('/v2-lab') ||
  window.location.hash === '#v2-lab'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isV2Lab ? <InvestorCabinetV2Lab /> : <App />}
  </React.StrictMode>,
)
