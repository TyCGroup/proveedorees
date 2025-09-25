// firebase-config.js - Configuración para producción
const firebaseConfig = {
  apiKey: "AIzaSyDyPDU_hK1ams7Mjc-LVJrY3DY2trTRqUQ",
  authDomain: "compras-tyc.firebaseapp.com",
  projectId: "compras-tyc",
  storageBucket: "compras-tyc.appspot.com",
  messagingSenderId: "501430906025",
  appId: "1:501430906025:web:f36f72134d3b2239410db8"
};

// Detectar entorno automáticamente
const isProduction = window.location.hostname === 'tycproveedores.com';
const isStaging = window.location.hostname.includes('firebaseapp.com') || 
                 window.location.hostname.includes('web.app');
const isDevelopment = window.location.hostname.includes('localhost') || 
                     window.location.hostname.includes('127.0.0.1');

// URLs específicas por entorno
window.satFunctionURL = 'https://us-central1-compras-tyc.cloudfunctions.net/satExtract';

// Configuración específica del entorno
window.ENV_CONFIG = {
  environment: isProduction ? 'production' : (isStaging ? 'staging' : 'development'),
  baseURL: isProduction ? 'https://tycproveedores.com' : window.location.origin,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFileTypes: ['application/pdf'],
  enableAnalytics: isProduction,
  debugMode: isDevelopment,
  corsOrigins: [
    'https://tycproveedores.com',
    'https://compras-tyc.firebaseapp.com',
    'https://compras-tyc.web.app'
  ]
};

// Verificar que Firebase esté disponible
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK not loaded. Please check Firebase script tags.');
  throw new Error('Firebase SDK not loaded');
}

// Inicializar Firebase
if (firebase.apps.length === 0) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log(`Firebase initialized successfully for ${window.ENV_CONFIG.environment}`);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

try {
  // Inicializar servicios de Firebase
  window.firebaseAuth = firebase.auth();
  window.firebaseDB = firebase.firestore();
  window.firebaseStorage = firebase.storage();

  // Configuración de Firestore con cache persistente para producción
  const firestoreSettings = {
    cacheSizeBytes: isProduction ? 
      firebase.firestore.CACHE_SIZE_UNLIMITED : 
      40 * 1024 * 1024, // 40MB para desarrollo
    merge: true
  };

  try {
    window.firebaseDB.settings(firestoreSettings);
    console.log('Firestore configured for', window.ENV_CONFIG.environment);
  } catch (settingsError) {
    console.log('Firestore settings already configured');
  }

  window.firebaseLoaded = true;
  
  // Google Analytics solo en producción
  if (isProduction && typeof gtag !== 'undefined') {
    gtag('config', 'GA_MEASUREMENT_ID', {
      page_title: 'Portal de Proveedores T&C Group',
      page_location: window.location.href,
      custom_map: {
        'environment': 'production'
      }
    });
  }

  console.log('Firebase services initialized for production');

} catch (error) {
  console.error('Firebase services initialization error:', error);
  window.firebaseLoaded = false;
}