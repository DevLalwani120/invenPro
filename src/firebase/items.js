import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, getDocs, query, orderBy, serverTimestamp,
  where, writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "items";

export const addItem    = (data)     => addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
export const updateItem = (id, data) => updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });

// Delete item AND all its batches together
export const deleteItem = async (id) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, id));

  const batchesSnap = await getDocs(
    query(collection(db, "batches"), where("itemId", "==", id))
  );
  batchesSnap.forEach((batchDoc) => {
    batch.delete(batchDoc.ref);
  });

  await batch.commit();
};

/**
 * Live listener — fires immediately, then on every change. Free, no quota cost
 * beyond normal Firestore reads.
 */
export const listenItems = (callback) => {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};
