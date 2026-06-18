import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { decodeProperty } from './utils/share'
import { usePropertyStore } from './store/usePropertyStore'

// Load shared property from URL on startup
const params = new URLSearchParams(window.location.search)
const encoded = params.get('p')
if (encoded) {
  const decoded = decodeProperty(encoded)
  if (decoded) {
    usePropertyStore.setState({ input: decoded })
    // Auto-calculate after load
    setTimeout(() => usePropertyStore.getState().calculate(), 100)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
