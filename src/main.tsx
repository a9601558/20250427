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
  // 添加额外的参数以确保使用正确的登录流程
  extraQueryParams: {
    response_mode: "query",
    // 强制显示用户名/密码登录界面
    identity_provider: "COGNITO",
    // 指定认证流程类型
    prompt: "login",
    // 确保显示完整的登录界面（包括忘记密码链接）
    ui_locales: "ja"
  },
  // 设置自动silent renew
  automaticSilentRenew: true,
  // 设置token存储
  userStore: new WebStorageStateStore({ store: window.localStorage }),
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
