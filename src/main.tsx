import React from 'react'
import ReactDOM from 'react-dom/client'
import InvestorCabinetV2Lab from './v2/InvestorCabinetV2Lab'
import { AuthProvider } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import './components/errorBoundary.css'

// Scale the entire UI proportionally on screens narrower than the design width.
// The dashboard is designed for 1440px — on small LAPTOPS (768–1440) the whole
// page zooms out so the layout stays intact.
//
// На мобильных (<768px) desktop-zoom НЕ применяем: он сжимал бы всё в разы
// (модалка входа схлопывалась до ~120px). Там работает нативная адаптивная
// вёрстка (media queries + мобильный таб-бар).
const DESIGN_WIDTH = 1440;
const MOBILE_BREAKPOINT = 768;

function applyViewportScale() {
  const w = window.innerWidth;
  if (!w || w < MOBILE_BREAKPOINT) {
    document.documentElement.style.zoom = '';
    return;
  }
  const scale = Math.min(1, w / DESIGN_WIDTH);
  document.documentElement.style.zoom = scale < 1 ? String(scale) : '';
}

applyViewportScale();
window.addEventListener('resize', applyViewportScale, { passive: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <InvestorCabinetV2Lab />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
