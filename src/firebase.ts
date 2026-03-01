import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "asset-tracker-st.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "asset-tracker-st.firebasestorage.app",
  messagingSenderId: "289793239958",
  appId: "1:289793239958:web:b72b1d7b385ee755da0bb7",
  databaseURL: "https://asset-tracker-st-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app, firebaseConfig.databaseURL);
