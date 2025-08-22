// Firebase configuration using compat SDK
const firebaseConfig = {
  apiKey: "AIzaSyDyPDU_hK1ams7Mjc-LVJrY3DY2trTRqUQ",
  authDomain: "compras-tyc.firebaseapp.com",
  projectId: "compras-tyc",
  storageBucket: "compras-tyc.firebasestorage.app",
  messagingSenderId: "501430906025",
  appId: "1:501430906025:web:f36f72134d3b2239410db8"
};

// Verificar que Firebase esté disponible
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK not loaded. Please check Firebase script tags.');
  throw new Error('Firebase SDK not loaded');
}

// Verificar si ya se inicializó Firebase
if (firebase.apps.length === 0) {
  try {
    // Initialize Firebase using compat SDK
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');
  } catch (error) {
    console.error('Firebase app initialization error:', error);
    window.firebaseLoaded = false;
    throw error;
  }
} else {
  console.log('Firebase app already initialized');
}

try {
  // Initialize Firebase services
  window.firebaseAuth = firebase.auth();
  window.firebaseDB = firebase.firestore();
  window.firebaseStorage = firebase.storage();

  // Configure Firestore settings SOLO si no está ya configurado
  const firestoreSettings = {
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    merge: true  // Evita el warning de override
  };

  // Solo aplicar settings si es la primera vez
  try {
    window.firebaseDB.settings(firestoreSettings);
    console.log('Firestore settings applied');
  } catch (settingsError) {
    // Si falla es porque ya está configurado, ignorar
    console.log('Firestore settings already configured');
  }

  // Habilitar persistencia solo si no está ya habilitada
  // Usar el método moderno en lugar del deprecado
  window.firebaseDB.enablePersistence({ synchronizeTabs: true })
    .then(() => {
      console.log('Firestore persistence enabled');
    })
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not supported by browser');
      } else if (err.code == 'already-enabled') {
        console.log('Firestore persistence already enabled');
      } else {
        console.warn('Firestore persistence error:', err);
      }
    });

  // Set global flag for other scripts
  window.firebaseLoaded = true;
  
  console.log('Firebase services initialized successfully');

} catch (error) {
  console.error('Firebase services initialization error:', error);
  window.firebaseLoaded = false;
  
  // Mostrar error al usuario si es necesario
  if (typeof window.showErrorMessage === 'function') {
    window.showErrorMessage('Error de conexión con la base de datos. Por favor, recarga la página.');
  }
}