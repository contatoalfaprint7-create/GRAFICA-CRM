import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAHLaLbKvXXA1HOsjgcDpCghjUq137XV7Y",
  authDomain: "grafica-crm.firebaseapp.com",
  databaseURL: "https://grafica-crm-default-rtdb.firebaseio.com",
  projectId: "grafica-crm",
  storageBucket: "grafica-crm.firebasestorage.app",
  messagingSenderId: "210284881910",
  appId: "1:210284881910:web:e87db6e98a56a68aea89d7"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
