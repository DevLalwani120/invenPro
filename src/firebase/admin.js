import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp,
  setDoc, getDoc,
} from "firebase/firestore";
import { db } from "./config";

// ── Categories ────────────────────────────────────────────────
export const getCategories = async () => {
  const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addCategory    = (name)     => addDoc(collection(db, "categories"), { name, active: true, createdAt: serverTimestamp() });
export const updateCategory = (id, data) => updateDoc(doc(db, "categories", id), data);
export const deleteCategory = (id)       => deleteDoc(doc(db, "categories", id));

// ── Units ─────────────────────────────────────────────────────
export const getUnits = async () => {
  const snap = await getDocs(query(collection(db, "units"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addUnit    = (name)     => addDoc(collection(db, "units"), { name, active: true, createdAt: serverTimestamp() });
export const updateUnit = (id, data) => updateDoc(doc(db, "units", id), data);
export const deleteUnit = (id)       => deleteDoc(doc(db, "units", id));

// ── Events (Add / Less) — used in Phase 2 ──────────────────────
export const getEvents = async () => {
  const snap = await getDocs(query(collection(db, "events"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addEvent    = (name, type) => addDoc(collection(db, "events"), { name, type, active: true, createdAt: serverTimestamp() });
export const updateEvent = (id, data)   => updateDoc(doc(db, "events", id), data);
export const deleteEvent = (id)         => deleteDoc(doc(db, "events", id));

// ── Users (stored in Firestore after signup) ──────────────────
export const getUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const upsertUser = (uid, data) =>
  setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const updateUser = (uid, data) =>
  updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });

export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── Login Logs ────────────────────────────────────────────────
export const addLoginLog = (uid, email, name) =>
  addDoc(collection(db, "loginLogs"), {
    uid, email, name: name || email,
    loginAt: serverTimestamp(),
    device: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
  });

export const getLoginLogs = async () => {
  const snap = await getDocs(query(collection(db, "loginLogs"), orderBy("loginAt", "desc")));
  return snap.docs.map(d => ({
    id: d.id, ...d.data(),
    loginAt: d.data().loginAt?.toDate?.() ?? null,
  }));
};