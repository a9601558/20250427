import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

// 确保在渲染前捕获任何可能的错误
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
