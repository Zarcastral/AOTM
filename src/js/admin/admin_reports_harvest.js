// reports.js
import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
    onSnapshot
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
import { getAuth, onAuthStateChanged } from "firebase/auth";

  // Initialize Firebase
const db = getFirestore(app);
const auth = getAuth();
