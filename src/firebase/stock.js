/**
 * ============================================================
 *  CORE STOCK CALCULATION LOGIC
 *  Single source of truth used by Dashboard, Item Master,
 *  Batch Manager, Batch Ledger, and Stock Report.
 *
 *  Batch Master's `quantity` field = OPENING qty (frozen, never edited).
 *  Closing qty is always computed live from Entry Sheet transactions.
 * ============================================================
 */

/**
 * Returns the signed effect of a transaction row.
 * Add  -> +qty
 * Less -> -qty
 */
export function rowDelta(qty, eventType) {
  const q = Number(qty) || 0;
  return eventType === "Less" ? -q : q;
}

/**
 * Build a map of batchId -> array of { date, delta, entry, row } touching that batch,
 * sorted oldest to newest by entry date. Defensive against malformed rows
 * (missing rate/amount, null date, etc.) so it never throws.
 */
export function buildBatchTransactionMap(entries, eventMap) {
  const map = {};
  if (!Array.isArray(entries)) return map;

  entries.forEach((entry) => {
    if (!entry || !Array.isArray(entry.rows)) return;
    const ev = eventMap ? eventMap[entry.eventId] : null;
    const eventType = ev?.type || "Add";

    entry.rows.forEach((row) => {
      if (!row || !row.batchId) return;
      const delta = rowDelta(row.qty, eventType);
      if (!map[row.batchId]) map[row.batchId] = [];
      map[row.batchId].push({ date: entry.date || null, delta, entry, row });
    });
  });

  Object.keys(map).forEach((batchId) => {
    map[batchId].sort((a, b) => {
      const da = a.date ? a.date.getTime() : 0;
      const db = b.date ? b.date.getTime() : 0;
      return da - db;
    });
  });

  return map;
}

/**
 * Compute the current closing quantity for ONE batch using ALL transactions
 * (no date filtering). This is what Dashboard/Item Master/Batch Manager use
 * for "current stock right now".
 */
export function computeClosingQty(batch, batchTxnMap) {
  if (!batch) return 0;
  const opening = Number(batch.quantity) || 0;
  const txns = (batchTxnMap && batchTxnMap[batch.id]) || [];
  const totalDelta = txns.reduce((sum, t) => sum + (t.delta || 0), 0);
  return opening + totalDelta;
}

export function computeAllClosingQtys(batches, batchTxnMap) {
  const result = {};
  (batches || []).forEach((b) => {
    result[b.id] = computeClosingQty(b, batchTxnMap);
  });
  return result;
}

export function computeStockMap(items, batches, batchTxnMap) {
  const closingMap = computeAllClosingQtys(batches, batchTxnMap);
  const stockMap = {};
  (items || []).forEach((item) => { stockMap[item.id] = 0; });
  (batches || []).forEach((b) => {
    stockMap[b.itemId] = (stockMap[b.itemId] || 0) + (closingMap[b.id] || 0);
  });
  return stockMap;
}

/**
 * Compute the FULL running ledger (every transaction, oldest -> newest)
 * for ONE batch — opening/closing per row, ignoring date range.
 * Used internally by the range-aware version below.
 */
export function computeFullBatchLedger(batch, batchTxnMap) {
  if (!batch) return [];
  const txns = (batchTxnMap && batchTxnMap[batch.id]) || [];
  let running = Number(batch.quantity) || 0;
  const rows = [];
  txns.forEach((t) => {
    const openingQty = running;
    const closingQty = running + (t.delta || 0);
    rows.push({
      date: t.entry.date,
      eventId: t.entry.eventId,
      docNo: t.entry.docNo,
      ledgerId: t.entry.ledgerId,
      qty: t.row.qty,
      rate: t.row.rate ?? null,
      amount: t.row.amount ?? null,
      openingQty,
      closingQty,
    });
    running = closingQty;
  });
  return rows;
}

/**
 * Backward-compatible alias (old name some pages might still import).
 */
export const computeBatchLedgerRows = computeFullBatchLedger;

/**
 * RANGE-AWARE ledger for one batch.
 *
 * Given a date range { from, to } (either can be null = unbounded):
 * - "Opening at range start" = batch's frozen opening qty + every txn
 *   that happened strictly BEFORE `from` (or batch opening if no `from`).
 * - Then only txns WITHIN [from, to] are listed with their own
 *   running opening/closing, continuing from that range-start opening.
 * - Txns AFTER `to` are ignored entirely (not shown, don't affect totals).
 *
 * Returns { openingAtStart, rows, closingAtEnd }.
 */
export function computeRangeBatchLedger(batch, batchTxnMap, range) {
  if (!batch) return { openingAtStart: 0, rows: [], closingAtEnd: 0 };

  const allTxns = (batchTxnMap && batchTxnMap[batch.id]) || [];
  const from = range?.from || null;
  const to   = range?.to   || null;

  let openingAtStart = Number(batch.quantity) || 0;
  const inRangeTxns = [];

  allTxns.forEach((t) => {
    const d = t.date ? t.date.getTime() : 0;
    const beforeStart = from ? d < from.getTime() : false;
    const afterEnd    = to   ? d > to.getTime()   : false;

    if (beforeStart) {
      openingAtStart += (t.delta || 0);
    } else if (!afterEnd) {
      inRangeTxns.push(t);
    }
    // txns after `to` are simply skipped — don't affect anything
  });

  let running = openingAtStart;
  const rows = inRangeTxns.map((t) => {
    const openingQty = running;
    const closingQty = running + (t.delta || 0);
    running = closingQty;
    return {
      date: t.entry.date,
      eventId: t.entry.eventId,
      docNo: t.entry.docNo,
      ledgerId: t.entry.ledgerId,
      ledgerOtherName: t.entry.ledgerOtherName || "",
      ledgerOtherMobile: t.entry.ledgerOtherMobile || "",
      ledgerOtherAddress: t.entry.ledgerOtherAddress || "",
      entry: t.entry,
      qty: t.row.qty,
      rate: t.row.rate ?? null,
      amount: t.row.amount ?? null,
      openingQty,
      closingQty,
    };
  });

  return { openingAtStart, rows, closingAtEnd: running };
}

/**
 * Filter a flat list of { date, ... } rows to only those within [from, to].
 * Used by Stock Report for per-item transaction history filtering.
 */
export function filterRowsByRange(rows, range) {
  const from = range?.from || null;
  const to   = range?.to   || null;
  if (!from && !to) return rows;
  return rows.filter((r) => {
    const d = r.date ? r.date.getTime() : 0;
    if (from && d < from.getTime()) return false;
    if (to   && d > to.getTime())   return false;
    return true;
  });
}
