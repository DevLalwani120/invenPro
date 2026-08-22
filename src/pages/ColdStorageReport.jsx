import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Snowflake, TrendingUp, TrendingDown, Search, Package, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Field, Empty, PrimaryBtn } from "../components/ui";
import { DateRangePicker } from "../components/DateRangePicker";
import SearchableSelect from "../components/SearchableSelect";
import { computeColdStorageReport } from "../firebase/stock";

export default function ColdStorageReport({ items, batches, ledger, batchTxnMap }) {
  // "location" = pick a Cold Storage, see everything stored there (original behavior)
  // "item"     = pick an Item, see every Cold Storage location currently holding it
  const [mode,     setMode]     = useState("location");

  const [ledgerId, setLedgerId] = useState("");
  const [itemId,   setItemId]   = useState("");
  const [range,    setRange]    = useState({ from: null, to: null });
  const [report,       setReport]       = useState(null); // location-mode result
  const [itemReport,   setItemReport]   = useState(null); // item-mode result
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null); // batchId (location mode) or ledgerId (item mode) of expanded row

  const safeItems   = items   || [];
  const safeBatches = batches || [];
  const safeLedger  = ledger  || [];
  const safeTxnMap  = batchTxnMap || {};

  const itemMap = Object.fromEntries(safeItems.map(i => [i.id, i]));

  const coldStorageLedgers = safeLedger.filter(l => l.type === "Cold Storage");
  const ledgerOptions = coldStorageLedgers.map(l => ({ value: l.id, label: l.name }));
  const itemOptions   = safeItems.map(i => ({ value: i.id, label: i.name, sub: i.category }));
  const selectedLedger = coldStorageLedgers.find(l => l.id === ledgerId) || null;
  const selectedItem   = itemMap[itemId] || null;

  const handleModeChange = (m) => {
    setMode(m);
    setReport(null);
    setItemReport(null);
    setExpanded(null);
    setSearch("");
  };

  const handleGetReport = () => {
    if (!ledgerId) return;
    const result = computeColdStorageReport(safeBatches, safeTxnMap, ledgerId, range);
    setReport(result);
    setExpanded(null);
  };

  // Loop over every Cold Storage ledger, pull its report, and keep only the
  // rows for the selected item — this answers "where is this item stored".
  const handleGetItemReport = () => {
    if (!itemId) return;
    const results = coldStorageLedgers
      .map((l) => {
        const full = computeColdStorageReport(safeBatches, safeTxnMap, l.id, range);
        const matched = (full.batchRows || []).filter(r => r.batch.itemId === itemId);
        if (matched.length === 0) return null;
        const totalRecd    = matched.reduce((s, r) => s + (r.totalRecd || 0), 0);
        const totalSent    = matched.reduce((s, r) => s + (r.totalSent || 0), 0);
        const totalBalance = matched.reduce((s, r) => s + (r.closingAtEnd || 0), 0);
        return { ledger: l, batchRows: matched, totalRecd, totalSent, totalBalance };
      })
      .filter(Boolean);
    setItemReport({ itemId, results });
    setExpanded(null);
  };

  const handleLedgerChange = (val) => { setLedgerId(val); setReport(null); };
  const handleItemChange   = (val) => { setItemId(val);   setItemReport(null); };
  const handleRangeChange  = (val) => { setRange(val); setReport(null); setItemReport(null); };

  // Global search across the resulting batch rows — matches item name, batch no, or doc no
  const visibleRows = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    if (!q) return report.batchRows;
    return report.batchRows.filter((r) => {
      const item = itemMap[r.batch.itemId];
      const hitsItem  = item?.name?.toLowerCase().includes(q);
      const hitsBatch = r.batch.batchNo?.toLowerCase().includes(q);
      const hitsDoc   = r.rows.some(row => row.docNo?.toLowerCase().includes(q));
      return hitsItem || hitsBatch || hitsDoc;
    });
  }, [report, search, itemMap]);

  // Search across item-mode results — matches location name or batch no
  const visibleLocations = useMemo(() => {
    if (!itemReport) return [];
    const q = search.trim().toLowerCase();
    if (!q) return itemReport.results;
    return itemReport.results.filter((res) => {
      const hitsLedger = res.ledger.name?.toLowerCase().includes(q);
      const hitsBatch  = res.batchRows.some(r => r.batch.batchNo?.toLowerCase().includes(q));
      return hitsLedger || hitsBatch;
    });
  }, [itemReport, search]);

  const grandItemBalance = itemReport ? itemReport.results.reduce((s, r) => s + r.totalBalance, 0) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
          <Snowflake size={24} className="text-cyan-600"/> Cold Storage Report
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {mode === "location"
            ? "Select a cold storage location and date range, then click Get Report"
            : "Select an item to find every cold storage location currently holding it"}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200 w-fit">
          <button type="button" onClick={() => handleModeChange("location")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
              ${mode === "location" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-white"}`}>
            <Snowflake size={13}/> By Location
          </button>
          <button type="button" onClick={() => handleModeChange("item")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
              ${mode === "item" ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-white"}`}>
            <Package size={13}/> By Item
          </button>
        </div>

        {mode === "location" ? (
          <>
            <Field label="Select Cold Storage *">
              <SearchableSelect
                options={ledgerOptions}
                value={ledgerId}
                onChange={handleLedgerChange}
                placeholder="— Select Cold Storage —"
              />
            </Field>

            <DateRangePicker value={range} onChange={handleRangeChange}/>

            <PrimaryBtn onClick={handleGetReport} disabled={!ledgerId}>
              <Search size={15}/> Get Report
            </PrimaryBtn>
          </>
        ) : (
          <>
            <Field label="Select Item *">
              <SearchableSelect
                options={itemOptions}
                value={itemId}
                onChange={handleItemChange}
                placeholder="— Select Item —"
              />
            </Field>

            <DateRangePicker value={range} onChange={handleRangeChange}/>

            <PrimaryBtn onClick={handleGetItemReport} disabled={!itemId}>
              <Search size={15}/> Find Cold Storages
            </PrimaryBtn>
          </>
        )}
      </div>

      {coldStorageLedgers.length === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          ❄️ No Cold Storage ledgers yet — add one from Ledger Master (type: Cold Storage) first.
        </div>
      )}

      {mode === "location" ? (
        !report ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Empty icon={Snowflake} title="No report yet" sub="Select a cold storage location above, then click Get Report"/>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="font-bold text-slate-800 text-lg">{selectedLedger?.name}</p>
              <p className="text-xs text-slate-400 mb-4">Cold Storage location</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Total Received</p>
                  <p className="font-bold text-slate-800 text-lg mt-1">{report.grandRecd}</p>
                </div>
                <div className="bg-red-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">Total Sent</p>
                  <p className="font-bold text-slate-800 text-lg mt-1">{report.grandSent}</p>
                </div>
                <div className="bg-cyan-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Currently Stored</p>
                  <p className="font-bold text-slate-800 text-lg mt-1">{report.grandBalance}</p>
                </div>
              </div>
            </div>

            {/* Global search + batch table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="font-bold text-slate-800 text-sm mb-3" style={{fontFamily:"'Syne',sans-serif"}}>
                  Batches ({visibleRows.length})
                </p>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by item, batch no, or doc no…"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
              </div>

              {visibleRows.length === 0 ? (
                <Empty icon={Package} title="No batches found" sub="Try a different search term or a wider date range"/>
              ) : (
                <div className="divide-y divide-slate-50">
                  {visibleRows.map((r) => {
                    const item = itemMap[r.batch.itemId];
                    const isOpen = expanded === r.batch.id;
                    return (
                      <div key={r.batch.id}>
                        <div
                          onClick={() => setExpanded(isOpen ? null : r.batch.id)}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-slate-700 text-sm">{item?.name || "—"}</p>
                            <p className="text-xs font-mono text-teal-700 mt-0.5">{r.batch.batchNo}</p>
                          </div>
                          <div className="flex items-center gap-5 text-right">
                            <div>
                              <p className="text-xs text-emerald-600 font-semibold">+{r.totalRecd}</p>
                              <p className="text-xs text-red-500 font-semibold">−{r.totalSent}</p>
                            </div>
                            <div className="w-20">
                              <p className="text-xs text-slate-400 uppercase tracking-wide">Balance</p>
                              <p className="font-bold text-slate-800">{r.closingAtEnd} <span className="text-xs font-normal text-slate-400">{item?.unit}</span></p>
                            </div>
                            {isOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="bg-slate-50/60 px-5 py-3">
                            {r.rows.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">No movement in this date range</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-400 uppercase tracking-wide">
                                    {["Date","Event","Doc No","Qty","Opening","Closing"].map(h => (
                                      <th key={h} className="text-left px-3 py-2">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.rows.map((row, i) => {
                                    const isAdd = row.delta >= 0;
                                    return (
                                      <tr key={i} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                          {row.date ? format(row.date, "dd MMM yyyy") : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium w-fit
                                            ${isAdd ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                            {isAdd ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                                            {isAdd ? "Recd From" : "Sent To"}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-slate-500">{row.docNo || "—"}</td>
                                        <td className={`px-3 py-2 font-semibold ${isAdd ? "text-emerald-600" : "text-red-500"}`}>
                                          {isAdd ? "+" : "−"}{row.qty}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{row.openingQty}</td>
                                        <td className="px-3 py-2 font-bold text-slate-800">{row.closingQty}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        !itemReport ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Empty icon={Package} title="No lookup yet" sub="Select an item above, then click Find Cold Storages"/>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="font-bold text-slate-800 text-lg">{selectedItem?.name}</p>
              <p className="text-xs text-slate-400 mb-4">
                Stored across {itemReport.results.length} cold storage location{itemReport.results.length === 1 ? "" : "s"}
              </p>

              <div className="bg-cyan-50 rounded-xl px-4 py-3 w-fit">
                <p className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Currently Stored (all locations)</p>
                <p className="font-bold text-slate-800 text-lg mt-1">{grandItemBalance} <span className="text-xs font-normal text-slate-400">{selectedItem?.unit}</span></p>
              </div>
            </div>

            {/* Search + per-location list */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="font-bold text-slate-800 text-sm mb-3" style={{fontFamily:"'Syne',sans-serif"}}>
                  Locations ({visibleLocations.length})
                </p>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by cold storage name or batch no…"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
              </div>

              {itemReport.results.length === 0 ? (
                <Empty icon={MapPin} title="Not in any cold storage" sub="This item currently has no stock recorded at a Cold Storage ledger"/>
              ) : visibleLocations.length === 0 ? (
                <Empty icon={Package} title="No locations found" sub="Try a different search term"/>
              ) : (
                <div className="divide-y divide-slate-50">
                  {visibleLocations.map((res) => {
                    const isOpen = expanded === res.ledger.id;
                    return (
                      <div key={res.ledger.id}>
                        <div
                          onClick={() => setExpanded(isOpen ? null : res.ledger.id)}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={15} className="text-cyan-600"/>
                            <p className="font-semibold text-slate-700 text-sm">{res.ledger.name}</p>
                          </div>
                          <div className="flex items-center gap-5 text-right">
                            <div>
                              <p className="text-xs text-emerald-600 font-semibold">+{res.totalRecd}</p>
                              <p className="text-xs text-red-500 font-semibold">−{res.totalSent}</p>
                            </div>
                            <div className="w-20">
                              <p className="text-xs text-slate-400 uppercase tracking-wide">Balance</p>
                              <p className="font-bold text-slate-800">{res.totalBalance} <span className="text-xs font-normal text-slate-400">{selectedItem?.unit}</span></p>
                            </div>
                            {isOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="bg-slate-50/60 px-5 py-3 space-y-3">
                            {res.batchRows.map((r) => (
                              <div key={r.batch.id}>
                                <p className="text-xs font-mono text-teal-700 mb-1.5">
                                  {r.batch.batchNo} <span className="text-slate-400 font-sans">— balance {r.closingAtEnd}</span>
                                </p>
                                {r.rows.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-1">No movement in this date range</p>
                                ) : (
                                  <table className="w-full text-xs mb-2">
                                    <thead>
                                      <tr className="text-slate-400 uppercase tracking-wide">
                                        {["Date","Event","Doc No","Qty","Opening","Closing"].map(h => (
                                          <th key={h} className="text-left px-3 py-2">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.rows.map((row, i) => {
                                        const isAdd = row.delta >= 0;
                                        return (
                                          <tr key={i} className="border-t border-slate-100">
                                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                              {row.date ? format(row.date, "dd MMM yyyy") : "—"}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium w-fit
                                                ${isAdd ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                                {isAdd ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                                                {isAdd ? "Recd From" : "Sent To"}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{row.docNo || "—"}</td>
                                            <td className={`px-3 py-2 font-semibold ${isAdd ? "text-emerald-600" : "text-red-500"}`}>
                                              {isAdd ? "+" : "−"}{row.qty}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500">{row.openingQty}</td>
                                            <td className="px-3 py-2 font-bold text-slate-800">{row.closingQty}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
