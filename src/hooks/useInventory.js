import { useState, useEffect, useCallback } from "react";
import { getItems, addItem, updateItem, deleteItem }       from "../firebase/items";
import { getBatches, addBatch, updateBatch, deleteBatch }  from "../firebase/batches";
import { getLedger, addLedger, updateLedger, deleteLedger } from "../firebase/ledger";

export function useInventory() {
  const [items,   setItems]   = useState([]);
  const [batches, setBatches] = useState([]);
  const [ledger,  setLedger]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [i, b, l] = await Promise.all([getItems(), getBatches(), getLedger()]);
      setItems(i); setBatches(b); setLedger(l);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now  = new Date();
  const warn = new Date(now.getTime() + 15 * 864e5);

  const stockMap = batches.reduce((acc, b) => {
    acc[b.itemId] = (acc[b.itemId] || 0) + (b.quantity || 0);
    return acc;
  }, {});

  const expiredBatches  = batches.filter((b) => b.expiryDate && b.expiryDate < now  && b.quantity > 0);
  const expiringBatches = batches.filter((b) => b.expiryDate && b.expiryDate >= now && b.expiryDate <= warn && b.quantity > 0);
  const lowStockItems   = items.filter((item) =>
    item.minStockLevel != null && (stockMap[item.id] ?? 0) <= Number(item.minStockLevel)
  );
  const totalAlerts = expiredBatches.length + expiringBatches.length + lowStockItems.length;

  const wrap = (fn) => async (...args) => { await fn(...args); fetchAll(); };

  return {
    items, batches, ledger, stockMap, loading, error,
    expiredBatches, expiringBatches, lowStockItems, totalAlerts,
    refetch:       fetchAll,
    addItem:       wrap(addItem),
    updateItem:    wrap((id, d) => updateItem(id, d)),
    deleteItem:    wrap(deleteItem),
    addBatch:      wrap(addBatch),
    updateBatch:   wrap((id, d) => updateBatch(id, d)),
    deleteBatch:   wrap(deleteBatch),
    addLedger:     wrap(addLedger),
    updateLedger:  wrap((id, d) => updateLedger(id, d)),
    deleteLedger:  wrap(deleteLedger),
  };
}
