import { useState, useEffect, useMemo } from "react";
import { listenItems, addItem, updateItem, deleteItem } from "../firebase/items";
import { listenBatches, addBatch, updateBatch, deleteBatch } from "../firebase/batches";
import { listenLedger, addLedger, updateLedger, deleteLedger } from "../firebase/ledger";
import { listenEntries } from "../firebase/entries";
import { computeStockMap, buildBatchTransactionMap, computeClosingQty } from "../firebase/stock";

const EXPIRY_WARN_DAYS = 15;

export function useInventory(events) {
  const [items,    setItems]    = useState([]);
  const [batches,  setBatches]  = useState([]);
  const [ledger,   setLedger]   = useState([]);
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Live listeners — fire immediately, then on every change ───
  useEffect(() => {
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= 4) setLoading(false);
    };

    const unsubItems = listenItems((data) => { setItems(data); markLoaded(); });
    const unsubBatches = listenBatches((data) => { setBatches(data); markLoaded(); });
    const unsubLedger = listenLedger((data) => { setLedger(data); markLoaded(); });
    const unsubEntries = listenEntries((data) => { setEntries(data); markLoaded(); });

    return () => {
      unsubItems();
      unsubBatches();
      unsubLedger();
      unsubEntries();
    };
  }, []);

  const eventMap = useMemo(
    () => Object.fromEntries((events || []).map(e => [e.id, e])),
    [events]
  );

  // ── Computed stock (live, derived from entries — never stored back) ──
  const batchTxnMap = useMemo(
    () => buildBatchTransactionMap(entries, eventMap),
    [entries, eventMap]
  );

  const stockMap = useMemo(
    () => computeStockMap(items, batches, batchTxnMap),
    [items, batches, batchTxnMap]
  );

  // ── Alerts (use live computed closing qty, not frozen opening qty) ──
  const now  = new Date();
  const warn = new Date(now.getTime() + EXPIRY_WARN_DAYS * 864e5);

  const closingQtyMap = useMemo(() => {
    const map = {};
    batches.forEach((b) => {
      map[b.id] = computeClosingQty(b, batchTxnMap);
    });
    return map;
  }, [batches, batchTxnMap]);

  const expiredBatches  = batches.filter((b) =>
    b.expiryDate && b.expiryDate < now && (closingQtyMap[b.id] ?? 0) > 0
  );
  const expiringBatches = batches.filter((b) =>
    b.expiryDate && b.expiryDate >= now && b.expiryDate <= warn && (closingQtyMap[b.id] ?? 0) > 0
  );
  const lowStockItems   = items.filter((item) =>
    item.minStockLevel != null && (stockMap[item.id] ?? 0) <= Number(item.minStockLevel)
  );
  const totalAlerts = expiredBatches.length + expiringBatches.length + lowStockItems.length;

  return {
    items, batches, ledger, entries, stockMap, batchTxnMap,
    loading, error,
    expiredBatches, expiringBatches, lowStockItems, totalAlerts,
    addItem, updateItem, deleteItem,
    addBatch, updateBatch, deleteBatch,
    addLedger, updateLedger, deleteLedger,
  };
}
