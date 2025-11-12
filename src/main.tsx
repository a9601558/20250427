import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'
import 'antd/dist/reset.css'
import { initAutoRefresh } from './utils/autoRefresh' // 2時間の自動リフレッシュ
import { AuthProvider } from "react-oidc-context"
import { WebStorageStateStore } from "oidc-client-ts"
import { installCognitoDebugger } from './utils/cognitoDebugger'


// Cognito OIDC 配置
const getRedirectUri = () => {
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }
  return "https://montopi.com";
};

const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9",
  client_id: "3tdjflgaoojolmlau5thc9lv5c",
  redirect_uri: getRedirectUri(),
  response_type: "code",
  scope: "email openid phone",
  post_logout_redirect_uri: getRedirectUri(),
  extraQueryParams: {
    response_mode: "query",
    ui_locales: "ja"
  },
  automaticSilentRenew: true,
  includeIdTokenInSilentRenew: true,
  userStore: new WebStorageStateStore({ 
    store: window.localStorage,
    prefix: "oidc.user."
  }),
  stateStore: new WebStorageStateStore({ 
    store: window.localStorage,
    prefix: "oidc.state." 
  }),
  loadUserInfo: true,
  silentRequestTimeout: 30000,
  monitorSession: true,
  checkSessionInterval: 10000,
  revokeTokenTypes: ["access_token", "refresh_token"]
}

if (import.meta.env.DEV) {
  installCognitoDebugger();
}

initAutoRefresh(7200000)

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
