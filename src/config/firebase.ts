import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase配置
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC08lcRdCrO9MF0fkbQGPvqbEiLpGwGaBA",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "examtopics-app.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "examtopics-app",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "examtopics-app.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "851234567890",
  appId: process.env.FIREBASE_APP_ID || "1:851234567890:web:ef1234567890abcdef1234"
};

// 检查当前环境是否需要使用 Firebase
const shouldUseFirebase = () => {
  // 在这个项目中我们实际上不需要 Firestore 服务
  // 检查当前是否为测试环境
  const isTestEnvironment = 
    window.location.hostname === 'localhost' || 
    window.location.hostname.includes('test') ||
    window.location.hostname.includes('staging');
  
  console.log(`[Firebase] Running in ${isTestEnvironment ? 'test' : 'production'} environment`);
  
  // 检查特定的 URL 标记或本地存储标记
  const disableFirebase = localStorage.getItem('app_disable_firebase') === 'true';
  
  if (disableFirebase) {
    console.log('[Firebase] Firebase disabled by local storage flag');
  }
  
  return !disableFirebase;
};

// 初始化 Firebase 变量
let app: FirebaseApp | null = null;
let db: any = null;
let auth: any = null;
let storage: any = null;

// 如果不需要使用 Firebase，则提供模拟对象
if (!shouldUseFirebase()) {
  console.log('[Firebase] Firebase services are disabled for this session');
  
  // 创建模拟对象
  const mockApp = {
    name: 'mock-firebase-app',
    options: firebaseConfig,
    automaticDataCollectionEnabled: false
  };
  
  const mockDb = {
    // 添加必要的模拟方法
    collection: () => ({ get: () => Promise.resolve([]) }),
    doc: () => ({ get: () => Promise.resolve({}) })
  };
  
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: (callback: any) => callback(null)
  };
  
  const mockStorage = {
    ref: () => ({})
  };
  
  app = mockApp as any;
  db = mockDb;
  auth = mockAuth;
  storage = mockStorage;
} else {
  // 正常初始化 Firebase
  try {
    console.log('[Firebase] Initializing Firebase with configuration:', { 
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain
    });
    
    const existingApps = getApps();
    if (existingApps.length === 0) {
      console.log('[Firebase] Creating new Firebase app instance');
      app = initializeApp(firebaseConfig);
    } else {
      console.log('[Firebase] Using existing Firebase app instance');
      app = existingApps[0];
    }
    
    // 初始化 Firebase 服务
    try {
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
      
      // 禁用 Firestore 持久化以减少不必要的网络请求
      // enableIndexedDbPersistence(db).catch(err => {
      //   console.log('[Firebase] Persistence could not be enabled:', err);
      // });
    } catch (serviceError) {
      console.error('[Firebase] Error initializing Firebase services:', serviceError);
    }
  } catch (error) {
    console.error('[Firebase] Fatal error initializing Firebase:', error);
    
    // 使用模拟对象替代
    const mockApp = { name: 'error-firebase-app' };
    const mockDb = { collection: () => ({ get: () => Promise.resolve([]) }) };
    const mockAuth = { currentUser: null };
    const mockStorage = { ref: () => ({}) };
    
    app = mockApp as any;
    db = mockDb;
    auth = mockAuth;
    storage = mockStorage;
    
    // 将错误添加到本地存储，避免未来的请求
    try {
      localStorage.setItem('app_firebase_error', JSON.stringify({ 
        timestamp: Date.now(),
        message: error instanceof Error ? error.message : String(error)
      }));
    } catch (e) {
      // 忽略本地存储错误
    }
  }
}

// 添加一个功能来完全禁用 Firebase
export const disableFirebase = () => {
  try {
    localStorage.setItem('app_disable_firebase', 'true');
    console.log('[Firebase] Firebase has been disabled for future sessions');
    return true;
  } catch (e) {
    console.error('[Firebase] Could not disable Firebase:', e);
    return false;
  }
};

// 导出服务
export { app, db, auth, storage }; 