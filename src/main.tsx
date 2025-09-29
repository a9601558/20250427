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

// 弹窗回调处理器
const getPopupRedirectUri = () => {
  const baseUri = getRedirectUri();
  return `${baseUri}/popup-callback.html`; // 使用专门的弹窗回调页面
};

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9",
  client_id: "3tdjflgaoojolmlau5thc9lv5c",
  redirect_uri: getRedirectUri(),
  response_type: "code",
  scope: "email openid phone",
  post_logout_redirect_uri: getRedirectUri(),
  // 弹窗登录专用的重定向URI
  popup_redirect_uri: getPopupRedirectUri(),
  // 简化extraQueryParams，确保兼容注册和登录
  extraQueryParams: {
    response_mode: "query",
    ui_locales: "ja"
  },
  // 设置自动silent renew
  automaticSilentRenew: true,
  // 设置token存储
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // 启用用户信息加载以获取完整profile
  loadUserInfo: true,  // 改为true以获取完整用户信息
  // 设置更严格的状态验证
  stateStore: new WebStorageStateStore({ 
    store: window.sessionStorage,
    prefix: "oidc.state." 
  }),
  // 增加超时设置
  silentRequestTimeout: 10000,
  // 确保不会自动重定向到特定页面
  monitorSession: false,
  // 设置检查会话间隔
  checkSessionInterval: 2000,
  // 启用更详细的日志
  revokeTokenTypes: ["access_token", "refresh_token"],
  // 使用自定义弹窗打开器
  popupWindowFeatures: `width=500,height=700,left=${window.screen.width / 2 - 250},top=${window.screen.height / 2 - 350},scrollbars=yes,resizable=yes`,
  // 弹窗窗口目标
  popupWindowTarget: "_blank"
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
