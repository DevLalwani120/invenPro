import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL = "ledger";

export const addLedger    = (data)     => addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
export const updateLedger = (id, data) => updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
export const deleteLedger = (id)       => deleteDoc(doc(db, COL, id));

export const getLedger = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
