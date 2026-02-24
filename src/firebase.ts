import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDIyGG-adibv3j7enTocrvORf07f8MU2qw",
  authDomain: "asset-tracker-st.firebaseapp.com",
  projectId: "asset-tracker-st",
  storageBucket: "asset-tracker-st.firebasestorage.app",
  messagingSenderId: "289793239958",
  appId: "1:289793239958:web:b72b1d7b385ee755da0bb7",
  databaseURL: "https://asset-tracker-st-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app, firebaseConfig.databaseURL);
