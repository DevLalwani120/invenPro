import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth }                          from "./config";
import { upsertUser, addLoginLog }       from "./admin";

export const signup = async (email, password, name) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  // Save user to Firestore
  await upsertUser(result.user.uid, {
    name, email, role: "user", active: true,
    createdAt: new Date(),
  });
  // Log first login
  await addLoginLog(result.user.uid, email, name);
  return result.user;
};

export const login = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  // Log login
  await addLoginLog(result.user.uid, email, result.user.displayName || email);
  return result.user;
};

export const logout = () => signOut(auth);

export const forgotPassword = (email) => sendPasswordResetEmail(auth, email);
