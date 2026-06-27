import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL = "ledger";

export const addLedger    = (data)     => addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
export const updateLedger = (id, data) => updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
export const deleteLedger = (id)       => deleteDoc(doc(db, COL, id));

export const listenLedger = (callback) => {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};
