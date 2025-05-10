// Firebase mock services without any real dependencies
// Completely disabled Firebase configuration
console.log('[Firebase] Firebase services are completely disabled');

// Mock Firebase variables
const app: any = null;
const db: any = {
  collection: () => ({ 
    get: () => Promise.resolve([]),
    add: () => Promise.resolve({ id: 'mock-id' }),
    doc: () => ({
      get: () => Promise.resolve({ exists: false, data: () => ({}) }),
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      delete: () => Promise.resolve()
    })
  }),
  doc: () => ({ 
    get: () => Promise.resolve({ exists: false, data: () => ({}) }),
    set: () => Promise.resolve(),
    update: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    collection: () => ({
      get: () => Promise.resolve([])
    })
  }),
  runTransaction: (fn: any) => Promise.resolve(fn({ get: () => Promise.resolve({ exists: false, data: () => ({}) }) })),
  batch: () => ({
    set: () => ({}),
    update: () => ({}),
    delete: () => ({}),
    commit: () => Promise.resolve()
  })
};

const auth: any = {
  currentUser: null,
  onAuthStateChanged: (callback: any) => {
    callback(null);
    return () => {};
  },
  signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase is disabled')),
  createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase is disabled')),
  signOut: () => Promise.resolve()
};

const storage: any = {
  ref: () => ({
    put: () => Promise.resolve({
      ref: {
        getDownloadURL: () => Promise.resolve('https://mock-url.com/image.jpg')
      }
    }),
    listAll: () => Promise.resolve({ items: [] }),
    getDownloadURL: () => Promise.resolve('https://mock-url.com/image.jpg')
  })
};

// Add a function to check if Firebase is disabled
export const isFirebaseDisabled = () => true;

// Export mock services
export { app, db, auth, storage };

// Maintain the disableFirebase function for compatibility
export const disableFirebase = () => {
  console.log('[Firebase] Firebase is already disabled by default');
  return true;
}; 