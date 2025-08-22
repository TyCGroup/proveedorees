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

try {
  // Initialize Firebase using compat SDK
  firebase.initializeApp(firebaseConfig);

  // Initialize Firebase Authentication and Firestore
  // Make auth and db available globally
  window.firebaseAuth = firebase.auth();
  window.firebaseDB = firebase.firestore();
  window.firebaseStorage = firebase.storage();

  // Configure Firestore settings for better performance
  window.firebaseDB.enablePersistence()
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
      } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not supported by browser');
      }
    });

  // Set up Firestore settings
  window.firebaseDB.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
  });

  // Set global flag for other scripts
  window.firebaseLoaded = true;
  
  console.log('Firebase initialized successfully');

} catch (error) {
  console.error('Firebase initialization error:', error);
  window.firebaseLoaded = false;
  
  // Mostrar error al usuario si es necesario
  if (window.showErrorMessage) {
    window.showErrorMessage('Error de conexión con la base de datos. Por favor, recarga la página.');
  }
}