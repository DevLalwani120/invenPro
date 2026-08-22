import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./config";

const COL = "entries";

/**
 * Entry document shape (pure transaction log — never mutates batches directly):
 * {
 *   date: Timestamp,
 *   eventId: string,
 *   docNo: string,
 *   ledgerId: string,
 *   rows: [ { itemId, batchId, qty, rate, amount }, ... ],  // rate/amount optional
 *   createdAt
 * }
 */

export const addEntry = (data) =>
  addDoc(collection(db, COL), {
    date:     Timestamp.fromDate(new Date(data.date)),
    eventId:  data.eventId,
    docNo:    data.docNo || "",
    ledgerId: data.ledgerId || "",
    ledgerOtherName:    data.ledgerOtherName    || "",
    ledgerOtherMobile:  data.ledgerOtherMobile  || "",
    ledgerOtherAddress: data.ledgerOtherAddress || "",
    rows:     data.rows,
    createdAt: serverTimestamp(),
  });

export const updateEntry = (id, data) =>
  updateDoc(doc(db, COL, id), {
    date:     Timestamp.fromDate(new Date(data.date)),
    eventId:  data.eventId,
    docNo:    data.docNo || "",
    ledgerId: data.ledgerId || "",
    ledgerOtherName:    data.ledgerOtherName    || "",
    ledgerOtherMobile:  data.ledgerOtherMobile  || "",
    ledgerOtherAddress: data.ledgerOtherAddress || "",
    rows:     data.rows,
    updatedAt: serverTimestamp(),
  });

export const deleteEntry = (id) => deleteDoc(doc(db, COL, id));

/** Create many entries atomically (used by Excel imports). */
export const addEntriesBatch = async (entries) => {
  const batch = writeBatch(db);
  const refs = [];

  (entries || []).forEach((data) => {
    const ref = doc(collection(db, COL));
    refs.push(ref);
    batch.set(ref, {
      date: Timestamp.fromDate(data.date instanceof Date ? data.date : new Date(data.date)),
      eventId: data.eventId,
      docNo: data.docNo || "",
      ledgerId: data.ledgerId || "",
      ledgerOtherName: data.ledgerOtherName || "",
      ledgerOtherMobile: data.ledgerOtherMobile || "",
      ledgerOtherAddress: data.ledgerOtherAddress || "",
      rows: data.rows || [],
      createdAt: serverTimestamp(),
    });
  });

  if (refs.length === 0) return [];
  await batch.commit();
  return refs;
};

/**
 * Live listener — fires immediately with current data, then again on
 * every change from any device/tab. Free, no extra cost or quota.
 */
export const listenEntries = (callback) => {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      date: d.data().date?.toDate?.() ?? null,
    }));
    callback(data);
  });
};
