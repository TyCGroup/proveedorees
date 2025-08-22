// Firebase configuration using compat SDK
const firebaseConfig = {
  apiKey: "AIzaSyDyPDU_hK1ams7Mjc-LVJrY3DY2trTRqUQ",
  authDomain: "compras-tyc.firebaseapp.com",
  projectId: "compras-tyc",
  storageBucket: "compras-tyc.firebasestorage.app",
  messagingSenderId: "501430906025",
  appId: "1:501430906025:web:f36f72134d3b2239410db8"
};

// Initialize Firebase using compat SDK
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
// Make auth and db available globally without redeclaring
window.firebaseAuth = firebase.auth();
window.firebaseDB = firebase.firestore();