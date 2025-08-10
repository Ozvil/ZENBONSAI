
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    })
  }
}
registerSW()

createRoot(document.getElementById('root')).render(<App />)
