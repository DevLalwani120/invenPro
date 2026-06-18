// ================================================================
//  📝 FILL THIS FILE ONLY — your project details go here
// ================================================================

import { initializeApp } from "firebase/app";
import { getFirestore }  from "firebase/firestore";
import { getAuth }              from "firebase/auth";

// ── 1. Firebase ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBWxpX25FWifQ4AVPr9LT3dqkJVIjVXdpY",
  authDomain: "united-potion-428819-g5.firebaseapp.com",
  projectId: "united-potion-428819-g5",
  storageBucket: "united-potion-428819-g5.firebasestorage.app",
  messagingSenderId: "625459555626",
  appId: "1:625459555626:web:2e6a135886a54b37e64253",
  measurementId: "G-K6HVEJDWJT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// ✅ SET YOUR ADMIN EMAIL HERE — only this email sees Admin Panel
export const ADMIN_EMAIL = "devlalwani120@gmail.com";