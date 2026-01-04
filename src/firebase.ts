import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB35QUVnRZA4RH3wJ5CEQjHQ-0AEX_oIR8",
  authDomain: "codebundler-pro.firebaseapp.com",
  projectId: "codebundler-pro",
  storageBucket: "codebundler-pro.firebasestorage.app",
  messagingSenderId: "230405342136",
  appId: "1:230405342136:web:de65d63a449fc33fdc454d"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
