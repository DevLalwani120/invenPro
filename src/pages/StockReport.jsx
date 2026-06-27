import { useState } from "react";
import { format } from "date-fns";
import { ClipboardList, TrendingUp, TrendingDown, Search } from "lucide-react";
import { Field, inputCls, Empty, PrimaryBtn } from "../components/ui";
import { DateRangePicker } from "../components/DateRangePicker";
import { computeRangeBatchLedger } from "../firebase/stock";

export default function StockReport({ items, batches, entries, events, ledger, stockMap, batchTxnMap, onViewTransaction }) {
  const [itemId,  setItemId]  = useState("");
  const [range,   setRange]   = useState({ from: null, to: null });
  const [report,  setReport]  = useState(null); // null until "Get Report" clicked

  const safeItems   = items   || [];
  const safeBatches = batches || [];
  const safeEvents  = events  || [];
  const safeLedger  = ledger  || [];
  const safeTxnMap  = batchTxnMap || {};

  const itemMap   = Object.fromEntries(safeItems.map(i => [i.id, i]));
  const eventMap  = Object.fromEntries(safeEvents.map(e => [e.id, e]));
  const ledgerMap = Object.fromEntries(safeLedger.map(l => [l.id, l]));

  const selectedItem = itemMap[itemId];

  const handleGetReport = () => {
    if (!itemId) return;

    const itemBatches = safeBatches.filter(b => b.itemId === itemId);
    let totalOpening = 0;
    let totalClosing = 0;
    const allRows = [];

    itemBatches.forEach((batch) => {
      let result;
      try {
        result = computeRangeBatchLedger(batch, safeTxnMap, range);
      } catch (e) {
        console.error("Stock report compute error:", e);
        result = { openingAtStart: Number(batch.quantity) || 0, rows: [], closingAtEnd: Number(batch.quantity) || 0 };
      }
      totalOpening += result.openingAtStart;
      totalClosing += result.closingAtEnd;
      result.rows.forEach((row) => {
        allRows.push({ ...row, batch });
      });
    });

    allRows.sort((a, b) => {
      const da = a.date ? a.date.getTime() : 0;
      const db = b.date ? b.date.getTime() : 0;
      return db - da;
    });

    setReport({ itemId, totalOpening, totalClosing, rows: allRows, itemBatches });
  };

  // If item or range changes after a report is shown, clear it so stale data isn't displayed
  const handleItemChange = (val) => { setItemId(val); setReport(null); };
  const handleRangeChange = (val) => { setRange(val); setReport(null); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
          <ClipboardList size={24} className="text-teal-600"/> Stock Report
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Select an item and date range, then click Get Report</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <Field label="Select Item *">
          <select value={itemId} onChange={e => handleItemChange(e.target.value)} className={inputCls}>
            <option value="">— Select Item —</option>
            {safeItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>

        <DateRangePicker value={range} onChange={handleRangeChange}/>

        <PrimaryBtn onClick={handleGetReport} disabled={!itemId}>
          <Search size={15}/> Get Report
        </PrimaryBtn>
      </div>

      {!report ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Empty icon={ClipboardList} title="No report yet" sub="Select an item and date range above, then click Get Report"/>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Item summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-slate-800 text-lg">{selectedItem?.name}</p>
                <p className="text-xs text-slate-400">{selectedItem?.category}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{stockMap?.[itemId] ?? 0} <span className="text-sm font-normal text-slate-400">{selectedItem?.unit}</span></p>
                <p className="text-xs text-slate-400">Current stock (live)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Opening (range start)</p>
                <p className="font-bold text-slate-800 text-lg mt-1">{report.totalOpening} {selectedItem?.unit}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Closing (range end)</p>
                <p className="font-bold text-slate-800 text-lg mt-1">{report.totalClosing} {selectedItem?.unit}</p>
              </div>
            </div>

            {report.itemBatches.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Batches</p>
                <div className="flex flex-wrap gap-2">
                  {report.itemBatches.map(b => (
                    <span key={b.id} className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                      <span className="font-mono text-teal-700">{b.batchNo}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="font-bold text-slate-800 text-sm" style={{fontFamily:"'Syne',sans-serif"}}>
                Transactions in range ({report.rows.length})
              </p>
            </div>
            {report.rows.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">No transactions in this date range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                      {["Date","Event","Batch","Doc/Ref No","Ledger","Qty","Rate","Amount"].map(h=>(
                        <th key={h} className="text-left px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => {
                      const ev    = eventMap[r.eventId];
                      const party = ledgerMap[r.ledgerId];
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
                          <td className="px-5 py-3 font-mono text-xs text-teal-700">{r.batch?.batchNo ?? "—"}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.docNo || "—"}</td>
                          <td className="px-5 py-3 text-slate-500">{party?.name ?? "—"}</td>
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
        </div>
      )}
    </div>
  );
}
