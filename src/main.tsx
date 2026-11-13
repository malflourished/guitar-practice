import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AnalogLab from './lab/AnalogLab.tsx'
import SoundLab from './lab/SoundLab.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AnalogLab />
    <SoundLab />
  </StrictMode>,
)
