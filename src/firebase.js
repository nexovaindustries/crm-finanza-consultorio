import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase - Reemplazar con las credenciales reales del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyBvFOrVVlL8yhv1mF8i4w9M6G6uWIv40no",
  authDomain: "madurando-talentos.firebaseapp.com",
  projectId: "madurando-talentos",
  storageBucket: "madurando-talentos.firebasestorage.app",
  messagingSenderId: "159830921787",
  appId: "1:159830921787:web:96e9594f877f240212f45c",
  measurementId: "G-8L9HVE39C6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
