import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL    = "batches";
const toTS   = (s) => Timestamp.fromDate(new Date(s));
const mapDoc = (d) => ({ id: d.id, ...d.data(), expiryDate: d.data().expiryDate?.toDate?.() ?? null });

export const addBatch = (data) =>
  addDoc(collection(db, COL), {
    ...data,
    expiryDate:    toTS(data.expiryDate),
    quantity:      Number(data.quantity),
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
