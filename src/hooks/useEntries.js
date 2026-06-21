import { useState, useEffect, useCallback } from "react";
import { getEntries, addEntry, updateEntry, deleteEntry } from "../firebase/entries";

export function useEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEntries();
      setEntries(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const wrap = (fn) => async (...args) => { await fn(...args); await fetchAll(); };

  return {
    entries, loading, error,
    refetch:     fetchAll,
    addEntry:    wrap(addEntry),
    updateEntry: wrap((id, d) => updateEntry(id, d)),
    deleteEntry: wrap(deleteEntry),
  };
}
