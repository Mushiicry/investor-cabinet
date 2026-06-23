import React from 'react'
import ReactDOM from 'react-dom/client'
import InvestorCabinetV2Lab from './v2/InvestorCabinetV2Lab'

// Scale the entire UI proportionally on screens narrower than the design width.
// The dashboard is designed for 1440px — on smaller viewports (13" MacBook,
// small laptop) the whole page zooms out so the layout stays intact.
const DESIGN_WIDTH = 1440;

function applyViewportScale() {
  const scale = Math.min(1, window.innerWidth / DESIGN_WIDTH);
  document.documentElement.style.zoom = scale < 1 ? String(scale) : '';
}

applyViewportScale();
window.addEventListener('resize', applyViewportScale, { passive: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InvestorCabinetV2Lab />
  </React.StrictMode>,
)
