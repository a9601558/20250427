import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'
import { Amplify } from 'aws-amplify'
import amplifyConfig from './config/amplifyConfig'

// 初始化 AWS Amplify
Amplify.configure(amplifyConfig)
console.log("AWS Amplify 已初始化，使用 Cognito 用户认证服务");

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
