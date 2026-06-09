import { useState, useCallback } from "react";
import { addBatch, updateBatch, deleteBatch } from "../firebase/batches";

export function useBatches(refetch) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (data) => {
    setSaving(true);
    try {
      await addBatch(data);
      await refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  const update = useCallback(async (id, data) => {
    setSaving(true);
    try {
      await updateBatch(id, data);
      await refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  const remove = useCallback(async (id) => {
    setSaving(true);
    try {
      await deleteBatch(id);
      await refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  return { saving, error, create, update, remove };
}
