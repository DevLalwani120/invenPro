import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL = "entries";

export const addEntry = (data) =>
  addDoc(collection(db, COL), {
    ...data,
    date:   Timestamp.fromDate(new Date(data.date)),
    qty:    Number(data.qty),
    rate:   Number(data.rate),
    amount: Number(data.amount),
    createdAt: serverTimestamp(),
  });

export const updateEntry = (id, data) =>
  updateDoc(doc(db, COL, id), {
    ...data,
    date:   Timestamp.fromDate(new Date(data.date)),
    qty:    Number(data.qty),
    rate:   Number(data.rate),
    amount: Number(data.amount),
    updatedAt: serverTimestamp(),
  });

export const deleteEntry = (id) => deleteDoc(doc(db, COL, id));

export const getEntries = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({
    id: d.id, ...d.data(),
    date: d.data().date?.toDate?.() ?? null,
  }));
};
