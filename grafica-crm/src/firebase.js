// src/firebase.js
// apiKey: "AIzaSyAHLaLbKvXXA1HOsjgcDpCghjUq137XV7Y",
  authDomain: "grafica-crm.firebaseapp.com",
  databaseURL: "https://grafica-crm-default-rtdb.firebaseio.com",
  projectId: "grafica-crm",
  storageBucket: "grafica-crm.firebasestorage.app",
  messagingSenderId: "210284881910",
  appId: "1:210284881910:web:e87db6e98a56a68aea89d7"} from "firebase/database";

const firebaseConfig = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  databaseURL:       "https://COLE_AQUI-default-rtdb.firebaseio.com",
  projectId:         "COLE_AQUI",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
