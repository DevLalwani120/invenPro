import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL    = "batches";
const toTS   = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};
const mapDoc = (d) => ({ id: d.id, ...d.data(), expiryDate: d.data().expiryDate?.toDate?.() ?? null });

export const addBatch = (data) =>
  addDoc(collection(db, COL), {
    ...data,
    expiryDate:    toTS(data.expiryDate),
    quantity:      Number(data.quantity), // opening qty, frozen after this
    purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : null,
    mrp:           data.mrp           ? Number(data.mrp)           : null,
    createdAt:     serverTimestamp(),
  });

export const updateBatch = (id, data) =>
  updateDoc(doc(db, COL, id), {
    ...data,
    expiryDate:    toTS(data.expiryDate),
    quantity:      Number(data.quantity),
    purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : null,
    mrp:           data.mrp           ? Number(data.mrp)           : null,
    updatedAt:     serverTimestamp(),
  });

export const deleteBatch = (id) => deleteDoc(doc(db, COL, id));

export const getBatches = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(mapDoc);
};

export const getBatch = async (id) => {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? mapDoc(snap) : null;
};

/**
 * Live listener — fires immediately, then on every change. Free, no quota cost
 * beyond normal Firestore reads.
 */
export const listenBatches = (callback) => {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(mapDoc));
  });
};
