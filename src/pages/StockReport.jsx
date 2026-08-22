import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ClipboardList, TrendingUp, TrendingDown, Search, ChevronDown } from "lucide-react";
import { Field, Empty, PrimaryBtn } from "../components/ui";
import { DateRangePicker } from "../components/DateRangePicker";
import { computeRangeBatchLedger } from "../firebase/stock";

// Lightweight multi-select with checkboxes + search, built inline so it
// doesn't depend on SearchableSelect's single-value API.
// Empty selection == "All Items" (this is the whole point of the feature).
function ItemMultiSelect({ items, selected, onChange, placeholder = "All Items" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q)) : items;
  const selectedSet = new Set(selected);
  const selectedLabels = items.filter(i => selectedSet.has(i.value)).map(i => i.label);

  const toggle = (id) => {
    if (selectedSet.has(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  let buttonText;
  if (selectedLabels.length === 0) buttonText = placeholder;
  else if (selectedLabels.length <= 2) buttonText = selectedLabels.join(", ");
  else buttonText = `${selectedLabels.length} items selected`;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-teal-400">
        <span className={selectedLabels.length ? "text-slate-700" : "text-slate-400"}>{buttonText}</span>
        <ChevronDown size={15} className="text-slate-400 shrink-0"/>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search items…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No items match</p>
            ) : filtered.map(i => (
              <label key={i.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                <input type="checkbox" checked={selectedSet.has(i.value)} onChange={() => toggle(i.value)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-400"/>
                <span className="flex-1 text-slate-700">{i.label}</span>
                {i.sub && <span className="text-xs text-slate-400">{i.sub}</span>}
              </label>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100 flex gap-2">
            <button type="button" onClick={() => onChange([])}
              className="flex-1 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
              Clear (= All Items)
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StockReport({ items, batches, entries, events, ledger, stockMap, batchTxnMap, onViewTransaction }) {
  const [itemIds, setItemIds] = useState([]); // empty == all items
  const [range,   setRange]   = useState({ from: null, to: null });
  const [report,  setReport]  = useState(null); // null until "Get Report" clicked
  const [search,  setSearch]  = useState("");

  const safeItems   = items   || [];
  const safeBatches = batches || [];
  const safeEvents  = events  || [];
  const safeLedger  = ledger  || [];
  const safeTxnMap  = batchTxnMap || {};

  const itemMap   = Object.fromEntries(safeItems.map(i => [i.id, i]));
  const eventMap  = Object.fromEntries(safeEvents.map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(safeLedger.map(l => [l.id, l]));

  const itemOptions = safeItems.map(i => ({ value: i.id, label: i.name, sub: i.category }));

  const handleGetReport = () => {
    // Empty selection means "all items" — that's the requested default.
    const targetItemIds = itemIds.length > 0 ? itemIds : safeItems.map(i => i.id);
    if (targetItemIds.length === 0) return;

    let totalOpening = 0;
    let totalClosing = 0;
    const allRows = [];
    const itemBreakdown = [];

    targetItemIds.forEach((id) => {
      const itemBatches = safeBatches.filter(b => b.itemId === id);
      let itemOpening = 0;
      let itemClosing = 0;

      itemBatches.forEach((batch) => {
        let result;
        try {
          result = computeRangeBatchLedger(batch, safeTxnMap, range);
        } catch (e) {
          console.error("Stock report compute error:", e);
          result = { openingAtStart: Number(batch.quantity) || 0, rows: [], closingAtEnd: Number(batch.quantity) || 0 };
        }
        itemOpening += result.openingAtStart;
        itemClosing += result.closingAtEnd;
        result.rows.forEach((row) => {
          allRows.push({ ...row, batch, itemId: id });
        });
      });

      totalOpening += itemOpening;
      totalClosing += itemClosing;
      itemBreakdown.push({ itemId: id, opening: itemOpening, closing: itemClosing, batches: itemBatches });
    });

    allRows.sort((a, b) => {
      const da = a.date ? a.date.getTime() : 0;
      const db = b.date ? b.date.getTime() : 0;
      return db - da;
    });

    setReport({ itemIds: targetItemIds, totalOpening, totalClosing, rows: allRows, itemBreakdown });
  };

  // If selection or range changes after a report is shown, clear it so stale data isn't displayed
  const handleItemsChange = (val) => { setItemIds(val); setReport(null); setSearch(""); };
  const handleRangeChange = (val) => { setRange(val); setReport(null); };

  // Global search across the resulting transaction rows — matches item name, event name, batch no, doc no, or ledger name
  const filteredRows = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    if (!q) return report.rows;
    return report.rows.filter((r) => {
      const ev    = eventMap[r.eventId];
      const party = ledgerMap[r.ledgerId];
      const item  = itemMap[r.batch?.itemId ?? r.itemId];
      return (
        item?.name?.toLowerCase().includes(q) ||
        ev?.name?.toLowerCase().includes(q) ||
        r.batch?.batchNo?.toLowerCase().includes(q) ||
        r.docNo?.toLowerCase().includes(q) ||
        party?.name?.toLowerCase().includes(q) ||
        r.entry?.ledgerOtherName?.toLowerCase().includes(q)
      );
    });
  }, [report, search, eventMap, ledgerMap, itemMap]);

  const isSingleItem = report?.itemIds.length === 1;
  const singleItem = isSingleItem ? itemMap[report.itemIds[0]] : null;
  const currentStockTotal = report
    ? report.itemIds.reduce((sum, id) => sum + (Number(stockMap?.[id]) || 0), 0)
    : 0;

  const rangeLabel = range?.from && range?.to
    ? `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`
    : range?.from
    ? `From ${format(range.from, "dd MMM yyyy")}`
    : range?.to
    ? `Until ${format(range.to, "dd MMM yyyy")}`
    : "All time";

  // Shared transaction-history table — same markup for single-item and multi/all-item reports.
  const transactionsSection = (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <p className="font-bold text-slate-800 text-sm mb-3" style={{fontFamily:"'Syne',sans-serif"}}>
          Transactions in range ({filteredRows.length})
        </p>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by item, event, batch no, doc no, or ledger…"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
      </div>
      {report?.rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">No transactions in this date range</p>
      ) : filteredRows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">No transactions match your search</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                {["Date","Event","Item","Batch","Doc/Ref No","Ledger","Qty","Rate","Amount"].map(h=>(
                  <th key={h} className="text-left px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => {
                const ev    = eventMap[r.eventId];
                const party = ledgerMap[r.ledgerId];
                const it    = itemMap[r.batch?.itemId ?? r.itemId];
                const isAdd = ev?.type === "Add";
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-teal-50/30 transition-colors cursor-pointer"
                    onClick={() => onViewTransaction && onViewTransaction(r.entry?.id)}>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {r.date ? format(r.date, "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium w-fit
                        ${isAdd ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {isAdd ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                        {ev?.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{it?.name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-teal-700">{r.batch?.batchNo ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.docNo || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {party?.name ?? "—"}
                      {r.entry?.ledgerOtherName && (
                        <span className="block text-xs text-purple-600 font-medium">
                          {r.entry.ledgerOtherName}
                          {r.entry.ledgerOtherMobile && <span className="text-slate-400"> · {r.entry.ledgerOtherMobile}</span>}
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-3 font-semibold ${isAdd ? "text-emerald-600" : "text-red-500"}`}>
                      {isAdd ? "+" : "−"}{r.qty}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.rate != null ? `₹${r.rate}` : "—"}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{r.amount != null ? `₹${r.amount}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
          <ClipboardList size={24} className="text-teal-600"/> Stock Report
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Select items (leave empty for all items) and a date range, then click Get Report</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <Field label="Select Items (leave empty for all)">
          <ItemMultiSelect items={itemOptions} selected={itemIds} onChange={handleItemsChange}/>
        </Field>

        <DateRangePicker value={range} onChange={handleRangeChange}/>

        <PrimaryBtn onClick={handleGetReport} disabled={safeItems.length === 0}>
          <Search size={15}/> Get Report
        </PrimaryBtn>
      </div>

      {!report ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Empty icon={ClipboardList} title="No report yet" sub="Select items (or leave empty for all) and a date range above, then click Get Report"/>
        </div>
      ) : isSingleItem ? (
        <div className="space-y-4">
          {/* Single-item summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-bold text-slate-800 text-lg">{singleItem?.name}</p>
                <p className="text-xs text-slate-400">{singleItem?.category}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">
                  {currentStockTotal} <span className="text-sm font-normal text-slate-400">{singleItem?.unit}</span>
                </p>
                <p className="text-xs text-slate-400">Current stock (live)</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">{rangeLabel}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Opening (range start)</p>
                <p className="font-bold text-slate-800 text-lg mt-1">{report.totalOpening} {singleItem?.unit}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Closing (range end)</p>
                <p className="font-bold text-slate-800 text-lg mt-1">{report.totalClosing} {singleItem?.unit}</p>
              </div>
            </div>

            {report.itemBreakdown[0]?.batches.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Batches</p>
                <div className="flex flex-wrap gap-2">
                  {report.itemBreakdown[0].batches.map(b => (
                    <span key={b.id} className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                      <span className="font-mono text-teal-700">{b.batchNo}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {transactionsSection}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi / all-items summary — no combined opening/closing sum, just a clean per-item table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div>
                <p className="font-bold text-slate-800 text-lg" style={{fontFamily:"'Syne',sans-serif"}}>
                  {itemIds.length === 0 ? "All Items" : `${report.itemIds.length} Items`}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{rangeLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">{currentStockTotal}</p>
                <p className="text-xs text-slate-400">Total current stock (live)</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                    {["Item","Category","Opening","Closing","Change","Current Stock","Batches"].map(h=>(
                      <th key={h} className="text-left px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.itemBreakdown.map(ib => {
                    const it = itemMap[ib.itemId];
                    const change = ib.closing - ib.opening;
                    return (
                      <tr key={ib.itemId} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700">{it?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-xs text-slate-400">{it?.category ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{ib.opening} <span className="text-xs text-slate-400">{it?.unit}</span></td>
                        <td className="px-5 py-3 text-slate-600">{ib.closing} <span className="text-xs text-slate-400">{it?.unit}</span></td>
                        <td className={`px-5 py-3 font-semibold ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-slate-400"}`}>
                          <span className="inline-flex items-center gap-1">
                            {change > 0 ? <TrendingUp size={12}/> : change < 0 ? <TrendingDown size={12}/> : null}
                            {change > 0 ? "+" : ""}{change}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{stockMap?.[ib.itemId] ?? 0} <span className="text-xs font-normal text-slate-400">{it?.unit}</span></td>
                        <td className="px-5 py-3 text-xs text-slate-400">{ib.batches.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {transactionsSection}
        </div>
      )}
    </div>
  );
}
