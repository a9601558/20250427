import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'

// 确保Firebase在应用启动时初始化 - 并添加错误处理
try {
  console.log("正在初始化Firebase...");
  // 动态导入以确保按正确顺序加载
  import('./config/firebase')
    .then(() => {
      console.log("Firebase初始化成功");
    })
    .catch((err) => {
      console.error("Firebase初始化失败:", err);
    });
} catch (error) {
  console.error("Firebase导入失败:", error);
}

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
