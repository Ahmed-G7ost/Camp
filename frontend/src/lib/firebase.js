// Firebase web SDK configuration (frontend-only, like cards project)
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut as fbSignOutFn } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDcEN56dYKuaZCJJOz111OVNpO5OZS1G50",
  authDomain: "camp-50ca4.firebaseapp.com",
  databaseURL: "https://camp-50ca4-default-rtdb.firebaseio.com",
  projectId: "camp-50ca4",
  storageBucket: "camp-50ca4.firebasestorage.app",
  messagingSenderId: "911317187019",
  appId: "1:911317187019:web:f17b75cc088b90d9325e4e",
  measurementId: "G-PX72FJ6EDS",
};

// Avoid duplicate app initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db, signInWithEmailAndPassword };
export const fbSignOut = fbSignOutFn;
export default app;
