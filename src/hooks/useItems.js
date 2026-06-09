import { useState, useEffect, useCallback } from "react";
import { getItems, addItem, updateItem, deleteItem } from "../firebase/items";
import { getBatches } from "../firebase/batches";

export function useItems() {
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsData, batchesData] = await Promise.all([
        getItems(),
        getBatches(),
      ]);
      setItems(itemsData);
      setBatches(batchesData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Compute current stock for each item
  const stockMap = batches.reduce((acc, b) => {
    acc[b.itemId] = (acc[b.itemId] || 0) + (b.quantity || 0);
    return acc;
  }, {});

  // Items with low stock
  const lowStockItems = items.filter(
    (item) =>
      item.minStockLevel != null &&
      (stockMap[item.id] ?? 0) <= Number(item.minStockLevel)
  );

  // Batches expiring in 15 days
  const now = new Date();
  const in15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const expiringBatches = batches.filter(
    (b) => b.expiryDate && b.expiryDate <= in15 && b.expiryDate >= now && b.quantity > 0
  );

  // Expired batches
  const expiredBatches = batches.filter(
    (b) => b.expiryDate && b.expiryDate < now && b.quantity > 0
  );

  return {
    items,
    batches,
    stockMap,
    lowStockItems,
    expiringBatches,
    expiredBatches,
    loading,
    error,
    refetch: fetchAll,
    addItem: async (data) => { await addItem(data); fetchAll(); },
    updateItem: async (id, data) => { await updateItem(id, data); fetchAll(); },
    deleteItem: async (id) => { await deleteItem(id); fetchAll(); },
  };
}
