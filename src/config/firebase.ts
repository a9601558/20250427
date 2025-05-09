import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

console.log('Firebase configuration initialized with:', { 
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket
});

// 初始化 Firebase - 确保只初始化一次
let app: FirebaseApp;

try {
  const existingApps = getApps();
  if (existingApps.length === 0) {
    console.log('Initializing new Firebase app instance');
    app = initializeApp(firebaseConfig);
  } else {
    console.log('Using existing Firebase app instance');
    app = existingApps[0];
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // 如果初始化失败，尝试一次带不同名称的初始化
  console.warn('Attempting to initialize Firebase with a different app name...');
  app = initializeApp(firebaseConfig, "examtopics-app-" + Date.now());
}

// 初始化 Firebase 服务
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// 导出服务
export { app, db, auth, storage }; 