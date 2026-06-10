// Firebase web SDK — frontend-only (no backend), like the cards project
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyDcEN56dYKuaZCJJOz111OVNpO5OZS1G50",
  authDomain: "camp-50ca4.firebaseapp.com",
  databaseURL: "https://camp-50ca4-default-rtdb.firebaseio.com",
  projectId: "camp-50ca4",
  storageBucket: "camp-50ca4.firebasestorage.app",
  messagingSenderId: "911317187019",
  appId: "1:911317187019:web:f17b75cc088b90d9325e4e",
};

const app = getApps().find((a) => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db, signInWithEmailAndPassword, fbSignOut };
export default app;
