import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh'
import { AuthProvider } from "react-oidc-context"
import { WebStorageStateStore } from "oidc-client-ts"


// Cognito OIDC 配置
const getRedirectUri = () => {
  // 在开发环境中使用端口3000，在生产环境中使用montopi.com域名
  if (import.meta.env.DEV) {
    return "http://localhost:3000"; // 使用Vite配置的端口3000
  }
  return "https://montopi.com"; // 使用AWS Cognito中配置的生产域名
};

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9",
  client_id: "3tdjflgaoojolmlau5thc9lv5c",
  redirect_uri: getRedirectUri(),
  response_type: "code",
  scope: "email openid phone",
  post_logout_redirect_uri: getRedirectUri(),
  // 优化登录体验参数
  extraQueryParams: {
    response_mode: "query",
    ui_locales: "ja"
  },
  // 优化token管理
  automaticSilentRenew: true,
  includeIdTokenInSilentRenew: true,
  // 优化存储配置，避免状态丢失
  userStore: new WebStorageStateStore({ 
    store: window.localStorage,
    prefix: "oidc.user."
  }),
  stateStore: new WebStorageStateStore({ 
    store: window.localStorage, // 改用localStorage以避免会话丢失
    prefix: "oidc.state." 
  }),
  // 启用完整用户信息加载
  loadUserInfo: true,
  // 优化超时和会话设置
  silentRequestTimeout: 15000,
  monitorSession: true,
  checkSessionInterval: 5000,
  // 启用更详细的日志
  revokeTokenTypes: ["access_token", "refresh_token"]
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
