import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'
import { AuthProvider } from "react-oidc-context"

// Cognito OIDC 配置
const getRedirectUri = () => {
  // 在开发环境中使用本地地址，在生产环境中使用 CloudFront 地址
  if (import.meta.env.DEV) {
    return window.location.origin; // http://localhost:5173
  }
  return "https://d84l1y8p4kdic.cloudfront.net";
};

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9",
  client_id: "3tdjflgaoojolmlau5thc9lv5c",
  redirect_uri: getRedirectUri(),
  response_type: "code",
  scope: "email openid phone",
  post_logout_redirect_uri: getRedirectUri(),
}

console.log("OIDC Cognito 已初始化，使用新的认证服务");
console.log("当前环境:", import.meta.env.DEV ? "开发环境" : "生产环境");
console.log("Redirect URI:", getRedirectUri());

// 初始化自动刷新功能，设置为2小时（7200000毫秒）
initAutoRefresh(7200000)

const root = ReactDOM.createRoot(document.getElementById('root')!)

// 使用 AuthProvider 包装应用
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
