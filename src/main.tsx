import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.tsx'
import { initAutoRefresh } from './config/auto-refresh'

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
