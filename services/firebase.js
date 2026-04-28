import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAXmEPfl-eOB3e6e0ddxrl77WTTw8EzNTk",
  authDomain: "pulse-13d8d.firebaseapp.com",
  projectId: "pulse-13d8d",
  storageBucket: "pulse-13d8d.firebasestorage.app",
  messagingSenderId: "653836972069",
  appId: "1:653836972069:web:434d9673075bf65f0b4fcc",
  measurementId: "G-482YB8D7TT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
  app,
  auth,
  db,
  storage,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  setDoc,
  ref,
  uploadString,
  getDownloadURL
};
