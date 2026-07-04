import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useTaskStore } from './store/task'
import { api } from './api'

// 订阅 Agent 事件，转发到 store
api.onAgentEvent((msg) => {
  useTaskStore.getState().appendEvent(msg)
})










ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
