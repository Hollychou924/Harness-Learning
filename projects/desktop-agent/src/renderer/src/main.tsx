import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useTaskStore } from './store/task'
import { api } from './api'

console.log('[renderer] main.tsx loaded', {
  href: window.location.href,
  userAgent: navigator.userAgent,
  hasApi: Boolean((globalThis as { api?: unknown }).api)
})

window.addEventListener('error', (event) => {
  console.error('[renderer] window.error', event.message, event.filename, event.lineno, event.colno)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandledrejection', event.reason)
})

// 订阅 Agent 事件，转发到 store
api.onAgentEvent((msg) => {
  useTaskStore.getState().appendEvent(msg)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

console.log('[renderer] React root rendered')
