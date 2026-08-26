import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Auto-updates the service worker as soon as a new deployment is found,
// instead of silently keeping the old cached version running until the
// person happens to fully close and reopen the app. Prevents "I pushed a
// fix but my phone still shows the old bug" confusion.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
