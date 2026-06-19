import { useState, useEffect, useCallback } from "react";
import {
  getCategories, addCategory, updateCategory, deleteCategory,
  getUnits, addUnit, updateUnit, deleteUnit,
  getEvents, addEvent, updateEvent, deleteEvent,
  getUsers, updateUser, getLoginLogs,
} from "../firebase/admin";

export function useAdmin() {
  const [categories, setCategories] = useState([]);
  const [units,      setUnits]      = useState([]);
  const [events,     setEvents]     = useState([]);
  const [users,      setUsers]      = useState([]);
  const [loginLogs,  setLoginLogs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, u, ev, us, ll] = await Promise.all([
        getCategories(), getUnits(), getEvents(), getUsers(), getLoginLogs()
      ]);
      setCategories(c);
      setUnits(u);
      setEvents(ev);
      setUsers(us);
      setLoginLogs(ll);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const wrap = (fn) => async (...args) => { await fn(...args); await fetchAll(); };

  return {
    categories, units, events, users, loginLogs, loading, error,
    refetch:        fetchAll,
    addCategory:    wrap(addCategory),
    updateCategory: wrap((id, d) => updateCategory(id, d)),
    deleteCategory: wrap(deleteCategory),
    addUnit:        wrap(addUnit),
    updateUnit:     wrap((id, d) => updateUnit(id, d)),
    deleteUnit:     wrap(deleteUnit),
    addEvent:       wrap((name, type) => addEvent(name, type)),
    updateEvent:    wrap((id, d) => updateEvent(id, d)),
    deleteEvent:    wrap(deleteEvent),
    updateUser:     wrap((id, d) => updateUser(id, d)),
  };
}