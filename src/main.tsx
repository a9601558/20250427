import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'

// Firebase 已被禁用，不再需要初始化
console.log("Firebase 已被禁用，应用将不使用 Firebase 服务");

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
