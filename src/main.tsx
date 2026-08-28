import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './v7-design-system.css'
import './mobile-ux-polish.css'
import './mobile-ux-m2.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
