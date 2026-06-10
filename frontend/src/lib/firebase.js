// Firebase web SDK — frontend-only (no backend). Deployable on Vercel.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Public Firebase web config (client keys are safe to ship to the browser)
export const firebaseConfig = {
  apiKey: "AIzaSyDcEN56dYKuaZCJJOz111OVNpO5OZS1G50",
  authDomain: "camp-50ca4.firebaseapp.com",
  databaseURL: "https://camp-50ca4-default-rtdb.firebaseio.com",
  projectId: "camp-50ca4",
  storageBucket: "camp-50ca4.firebasestorage.app",
  messagingSenderId: "911317187019",
  appId: "1:911317187019:web:f17b75cc088b90d9325e4e",
  measurementId: "G-PX72FJ6EDS",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db, signInWithEmailAndPassword, fbSignOut };
export default app;
