import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL = "items";

export const addItem    = (data)     => addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
export const updateItem = (id, data) => updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
export const deleteItem = (id)       => deleteDoc(doc(db, COL, id));

export const getItems = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
