import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// ── Login ─────────────────────────────────────────────────────
export const login = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await logLogin(cred.user);
  return cred.user;
};

// ── Logout ────────────────────────────────────────────────────
export const logout = () => signOut(auth);

// ── Auth state listener ───────────────────────────────────────
export const listenAuth = (callback) => onAuthStateChanged(auth, callback);

// ── Forgot password ───────────────────────────────────────────
export const forgotPassword = (email) => sendPasswordResetEmail(auth, email);

// ── Log login to Firestore ────────────────────────────────────
const logLogin = async (user) => {
  try {
    await setDoc(
      doc(db, "loginLogs", `${user.uid}_${Date.now()}`),
      {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email,
        loginAt: serverTimestamp(),
        device: /Mobile/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
      }
    );
  } catch { /* non-critical */ }
};

/**
 * Admin creates a new user via Firebase Identity Toolkit REST API.
 * Works on Spark (free) plan — no Cloud Functions needed.
 * Uses the same Web API key that's already bundled in your app.
 *
 * Note: The admin user who calls this stays signed in — the new user's
 * token is only used for account creation, never to switch sessions.
 * The new user can log in immediately with the given credentials,
 * or use "Forgot password" to set their own.
 */
export const adminCreateUser = async ({ email, password, name, role, apiKey }) => {
  // Step 1: Create the Firebase Auth account via REST
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message || "Failed to create user";
    throw new Error(
      msg === "EMAIL_EXISTS"
        ? "A user with this email already exists"
        : msg.includes("WEAK_PASSWORD")
        ? "Password must be at least 6 characters"
        : msg
    );
  }

  const uid = data.localId;

  // Step 2: Save the user profile to Firestore
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    name: name || email,
    role: role || "user",
    active: true,
    createdAt: serverTimestamp(),
  });

  return { uid, email };
};
