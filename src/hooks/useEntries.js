import { addEntry as addEntryFn, updateEntry as updateEntryFn, deleteEntry as deleteEntryFn } from "../firebase/entries";

/**
 * Entries are pure transaction logs now — no batch mutation happens here.
 * Batch quantities are always computed live from the entries list
 * (see firebase/stock.js). This hook just exposes simple CRUD;
 * the live `entries` array itself comes from useInventory's onSnapshot listener.
 */
export function useEntries() {
  const addEntry = async (data) => {
    await addEntryFn(data);
  };

  const updateEntry = async (id, data) => {
    await updateEntryFn(id, data);
  };

  const deleteEntry = async (id) => {
    await deleteEntryFn(id);
  };

  return { addEntry, updateEntry, deleteEntry };
}
