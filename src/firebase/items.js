import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp,
  where, writeBatch
} from "firebase/firestore";
import { db } from "./config";

const COL = "items";

export const addItem    = (data)     => addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
export const updateItem = (id, data) => updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });

// Delete item AND all its batches together
export const deleteItem = async (id) => {
  const batch = writeBatch(db);

  // 1. Delete the item
  batch.delete(doc(db, COL, id));

  // 2. Find all batches belonging to this item
  const batchesSnap = await getDocs(
    query(collection(db, "batches"), where("itemId", "==", id))
  );

  // 3. Add each batch to the delete batch
  batchesSnap.forEach((batchDoc) => {
    batch.delete(batchDoc.ref);
  });

  // 4. Commit all deletes in one go
  await batch.commit();
};

export const getItems = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};