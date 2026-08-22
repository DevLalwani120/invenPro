import { useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  Check,
  CheckCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";
import { Toast, useToast, Empty } from "../components/ui";
import { computeClosingQty } from "../firebase/stock";

const DAY_HEADERS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const HEADERS = ["Name of Item", ...DAY_HEADERS];

const pad = (n) => String(n).padStart(2, "0");
const monthValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const monthLabel = (value) => {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

function getCellText(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.result != null) return getCellText(value.result);
  return String(value).trim();
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function excelNumber(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function daysInMonth(month) {
  const [year, monthNo] = month.split("-").map(Number);
  return new Date(year, monthNo, 0).getDate();
}

function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
}

export default function ConsumptionImport({ items, batches, events, batchTxnMap, addEntriesBatch }) {
  const [consumptionMonth, setConsumptionMonth] = useState(monthValue(new Date()));
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, showToast] = useToast();
  const fileInputRef = useRef(null);

  const itemMap = useMemo(
    () => Object.fromEntries((items || []).map((item) => [normalizeName(item.name), item])),
    [items]
  );
  const itemIdMap = useMemo(
    () => Object.fromEntries((items || []).map((item) => [item.id, item])),
    [items]
  );
  const activeItems = useMemo(() => (items || []).filter((item) => item.active !== false), [items]);

  // Automatically use the existing `Consumption (-)` event.
  // The UI displays "Consumption (-)", while the stored event name is
  // normally "Consumption" and its type/effect is "Less".
  const consumptionEvent = useMemo(() => {
    return (events || []).find((event) => {
      const name = normalizeName(event.name || event.eventName);
      const type = normalizeName(
        event.type || event.eventType || event.transactionType || event.effect
      );

      return (
        (name === "consumption" || name === "consumption (-)") &&
        event.active !== false &&
        (!type || type === "less" || type === "-")
      );
    });
  }, [events]);

  const itemNameById = useMemo(
    () => Object.fromEntries(activeItems.map((item) => [item.id, item.name])),
    [activeItems]
  );

  const matchedRows = parsedRows.filter((row) => row.matchedItemId);
  const unmatchedRows = parsedRows.filter((row) => !row.matchedItemId);
  const rowTotalQty = (row) =>
    Object.values(row?.quantities || {}).reduce(
      (sum, qty) => sum + (Number(qty) || 0),
      0
    );

  const getCurrentBatchAvailability = (batch) =>
    Math.max(0, Number(computeClosingQty(batch, batchTxnMap || {})) || 0);

  const getItemAvailableQty = (itemId) =>
    (batches || [])
      .filter((batch) => batch.itemId === itemId)
      .reduce((sum, batch) => sum + getCurrentBatchAvailability(batch), 0);

  const getRowAvailability = (row) =>
    row?.matchedItemId ? getItemAvailableQty(row.matchedItemId) : 0;

  const isRowInsufficient = (row) => {
    const requested = rowTotalQty(row);
    const available = getRowAvailability(row);
    return requested > 0 && requested > available + 0.000001;
  };

  // Only rows that are actually importable are counted for the Import button.
  // A different insufficient row must never prevent a valid row such as
  // HARA MOONG (60 requested / 215.4 available) from being imported.
  const selectedRows = parsedRows.filter(
    (row) =>
      row.matchedItemId &&
      row.selected &&
      !row.hasInvalidQuantity &&
      !isRowInsufficient(row)
  );
  const checkedCount = selectedRows.length;

  const downloadTemplate = async () => {
    if (activeItems.length === 0) {
      showToast("Add items in Item Master first", "error");
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "InvenPro";
    const ws = wb.addWorksheet("Consumptions");
    const listWs = wb.addWorksheet("Lists");
    listWs.state = "veryHidden";

    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true, color: { argb: "FF0F172A" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F1EE" } };
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    ws.getColumn(1).width = 28;
    DAY_HEADERS.forEach((_, index) => { ws.getColumn(index + 2).width = 7; });
    ws.freezePanes = "B2";
    ws.autoFilter = { from: "A1", to: `AF${Math.max(2, activeItems.length + 1)}` };

    activeItems.forEach((item) => ws.addRow([item.name, ...DAY_HEADERS.map(() => "")]));

    listWs.getCell("A1").value = "Items";
    activeItems.forEach((item, index) => { listWs.getCell(`A${index + 2}`).value = item.name; });

    for (let row = 2; row <= Math.max(301, activeItems.length + 1); row++) {
      for (let col = 2; col <= 32; col++) {
        ws.getCell(row, col).dataValidation = {
          type: "decimal",
          allowBlank: true,
          operator: "greaterThanOrEqual",
          formulae: [0],
          showErrorMessage: true,
          errorTitle: "Invalid Quantity",
          error: "Consumption quantity must be a number greater than or equal to 0.",
        };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InvenPro_Consumption_Template_${consumptionMonth}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Template downloaded for ${monthLabel(consumptionMonth)}`);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("No worksheet found");

      const headerName = normalizeName(getCellText(ws.getCell(1, 1).value));
      if (headerName !== "name of item") {
        throw new Error('Invalid template. First header must be "Name of Item".');
      }

      const rows = [];
      const maxValidDay = daysInMonth(consumptionMonth);
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const sourceName = getCellText(row.getCell(1).value);
        const quantities = {};
        let hasQuantity = false;
        let hasInvalidQuantity = false;

        DAY_HEADERS.forEach((day, index) => {
          const raw = row.getCell(index + 2).value;
          if (raw == null || raw === "") return;
          const qty = excelNumber(raw);
          if (!Number.isFinite(qty) || qty < 0) {
            hasInvalidQuantity = true;
            return;
          }
          if (qty > 0) {
            if (Number(day) > maxValidDay) {
              hasInvalidQuantity = true;
              return;
            }
            quantities[day] = qty;
            hasQuantity = true;
          }
        });

        if (!sourceName && !hasQuantity && !hasInvalidQuantity) return;

        const matchedItem = itemMap[normalizeName(sourceName)] || null;
        rows.push({
          _rowNum: rowNumber,
          sourceName,
          matchedItemId: matchedItem?.id || "",
          quantities,
          hasQuantity,
          hasInvalidQuantity,
          selected: Boolean(matchedItem),
          matchManually: "",
        });
      });

      setParsedRows(rows);
      if (rows.length === 0) showToast("No consumption rows found in the uploaded file", "error");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not read the Excel file", "error");
      setParsedRows([]);
    }
  };

  const setRowSelected = (rowNumber, selected) => {
    setParsedRows((prev) => prev.map((row) => row._rowNum === rowNumber ? { ...row, selected } : row));
  };

  const setManualMatch = (rowNumber, itemId) => {
    setParsedRows((prev) => prev.map((row) => {
      if (row._rowNum !== rowNumber) return row;
      return { ...row, matchedItemId: itemId, matchManually: itemId, selected: Boolean(itemId) };
    }));
  };

  const availableMatchItems = (currentRow) => {
    const usedByOtherRows = new Set(
      parsedRows
        .filter((row) => row._rowNum !== currentRow._rowNum && row.matchedItemId)
        .map((row) => row.matchedItemId)
    );
    return activeItems.filter((item) => !usedByOtherRows.has(item.id));
  };

  const buildImportPlan = () => {
    const errors = [];
    const planByDate = {};
    const workingBatchQty = {};

    // Start from the SAME current batch closing quantity used everywhere else
    // in InvenPro. This means the number shown as Available Qty is the exact
    // number used for import validation.
    (batches || []).forEach((batch) => {
      workingBatchQty[batch.id] = getCurrentBatchAvailability(batch);
    });

    // IMPORTANT: stock validation is ITEM LEVEL only.
    // We compare the TOTAL quantity entered in Excel across all days
    // against the CURRENT available quantity of that item.
    // We do NOT validate stock separately for Day 1, Day 5, Day 10, etc.
    // Example: Excel total = 60 and current available = 215.4 -> allowed.
    // Only an item whose total Excel quantity is greater than its current
    // available quantity is blocked.
    const importableRows = selectedRows.filter((row) => {
      const requested = rowTotalQty(row);
      const available = getRowAvailability(row);
      return requested <= available + 0.000001;
    });

    if (importableRows.length === 0) {
      errors.push(
        "No selected item has sufficient available stock to import."
      );
      return { planByDate: {}, errors };
    }

    const days = daysInMonth(consumptionMonth);

    for (let day = 1; day <= days; day++) {
      const [year, month] = consumptionMonth
        .split("-")
        .map(Number);
      const date = new Date(year, month - 1, day);
      const dateKey = `${consumptionMonth}-${pad(day)}`;
      const rowsForDate = [];

      for (const row of importableRows) {
        const qty = Number(row.quantities[String(day)] || 0);
        if (!(qty > 0)) continue;

        const item = itemIdMap[row.matchedItemId];
        if (!item) continue;

        const itemBatches = (batches || [])
          .filter((batch) => batch.itemId === item.id)
          .map((batch) => ({
            batch,
            available: Number(workingBatchQty[batch.id] || 0),
          }))
          .filter(({ available }) => available > 0.0000001)
          .sort((a, b) => {
            const aExpiry = a.batch.expiryDate
              ? new Date(a.batch.expiryDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            const bExpiry = b.batch.expiryDate
              ? new Date(b.batch.expiryDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            return aExpiry - bExpiry;
          });

        let remaining = qty;

        for (const candidate of itemBatches) {
          if (remaining <= 0.0000001) break;

          const take = Math.min(remaining, candidate.available);
          if (take <= 0) continue;

          rowsForDate.push({
            itemId: item.id,
            batchId: candidate.batch.id,
            qty: formatQty(take),
            rate: null,
            amount: null,
          });

          workingBatchQty[candidate.batch.id] =
            Number(workingBatchQty[candidate.batch.id] || 0) - take;

          remaining -= take;
        }

        // This can only happen if the stock changed between rendering and
        // clicking Import. In that case fail safely rather than writing a
        // partial transaction.
        if (remaining > 0.0000001) {
          errors.push(
            `${item.name} on ${dateKey}: stock changed and only ${formatQty(
              qty - remaining
            )} of ${formatQty(qty)} could be allocated.`
          );
          continue;
        }
      }

      if (rowsForDate.length > 0) {
        planByDate[dateKey] = { date, rows: rowsForDate };
      }
    }

    return { planByDate, errors };
  };

  const handleImport = async () => {
    if (!consumptionEvent) {
      showToast('Event "Consumption (-)" was not found or is inactive.', "error");
      return;
    }
    if (checkedCount === 0) {
      showToast("Select at least one matched item", "error");
      return;
    }

    setImporting(true);
    try {
      const { planByDate, errors } = buildImportPlan();
      if (errors.length > 0) {
        showToast(errors[0], "error");
        setImportResult({ success: 0, failed: 0, errors });
        return;
      }

      const payloads = Object.values(planByDate).map(({ date, rows }) => ({
        date,
        eventId: consumptionEvent.id,
        docNo: `Consumption Import - ${consumptionMonth}`,
        ledgerId: "",
        rows,
      }));

      if (payloads.length === 0) {
        showToast("No positive consumption quantities found in the selected rows", "error");
        return;
      }

      await addEntriesBatch(payloads);
      setImportResult({ success: payloads.length, failed: 0, errors: [] });
      setParsedRows([]);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast(`Imported ${payloads.length} consumption day${payloads.length !== 1 ? "s" : ""}!`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Error importing consumptions", "error");
    } finally {
      setImporting(false);
    }
  };

  const resetUpload = () => {
    setParsedRows([]);
    setFileName("");
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast}/>

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{ fontFamily: "'Syne',sans-serif" }}>
            <FileSpreadsheet size={24} className="text-teal-600"/> Import Consumptions
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Import daily item consumption from the 1–31 Excel grid and save it as the Consumptions event.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Consumption Month</label>
            <input type="month" value={consumptionMonth} onChange={(e) => setConsumptionMonth(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"/>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors whitespace-nowrap">
            <Download size={15}/> Download Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-800 text-sm">Step 1 — Prepare the Excel</p>
            <p className="text-slate-500 text-xs mt-1">The template contains every active item and columns for days 1 to 31. The Total column is intentionally not included.</p>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">Import month: <span className="font-semibold text-slate-700">{monthLabel(consumptionMonth)}</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-800 text-sm mb-1">Step 2 — Upload Filled Template</p>
        <p className="text-slate-500 text-xs mb-4">Exact item names are matched automatically. Items that do not match can be mapped manually below.</p>
        <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer">
          <Upload size={24} className="text-slate-400"/>
          <span className="text-sm font-semibold text-slate-600">{fileName || "Click to select your .xlsx file"}</span>
          <span className="text-xs text-slate-400">Consumption template only</span>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden"/>
        </label>
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800 text-sm">Step 3 — Match & Review</p>
              <p className="text-xs text-slate-500 mt-0.5"><span className="text-emerald-600 font-semibold">{matchedRows.length} matched</span>{unmatchedRows.length > 0 && <> · <span className="text-amber-600 font-semibold">{unmatchedRows.length} unmatched</span></>}{checkedCount > 0 && <> · <span className="text-teal-600 font-semibold">{checkedCount} selected</span></>}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={resetUpload} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={importing || checkedCount === 0 || !consumptionEvent}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {importing ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>} {importing ? "Importing…" : `Import ${checkedCount}`}
              </button>
            </div>
          </div>

          {!consumptionEvent && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5"/>
              <span>Event <strong>Consumption (-)</strong> was not found or is inactive.</span>
            </div>
          )}

          <div className="p-5 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <div><h3 className="font-bold text-slate-800 text-sm">Matched Items</h3><p className="text-xs text-slate-400 mt-0.5">Select the rows you want to import.</p></div>
                <button onClick={() => setParsedRows((prev) => prev.map((row) => row.matchedItemId && !row.hasInvalidQuantity && !isRowInsufficient(row)
                              ? { ...row, selected: true }
                              : row))} className="text-xs font-semibold text-teal-600 hover:text-teal-700">Select All</button>
              </div>
              <div className="border border-slate-100 rounded-2xl overflow-auto max-h-[460px]">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                    <tr><th className="w-12 px-4 py-3 text-center">✓</th><th className="px-4 py-3 text-left">Excel Item</th><th className="px-4 py-3 text-left">Matched Item</th><th className="px-4 py-3 text-center">Days Filled</th><th className="px-4 py-3 text-right">Excel Qty</th><th className="px-4 py-3 text-right">Available Qty</th><th className="px-4 py-3 text-left">Status</th></tr>
                  </thead>
                  <tbody>
                    {matchedRows.map((row) => {
                      const daysFilled = Object.keys(row.quantities).length;
                      const total = rowTotalQty(row);
                      const available = getRowAvailability(row);
                      const insufficient = total > available + 0.0000001;
                      const hasQty = total > 0;
                      return (
                        <tr key={row._rowNum} className={`border-b border-slate-50 hover:bg-slate-50/50 ${insufficient && hasQty ? "bg-red-50/60" : ""}`}>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setRowSelected(row._rowNum, !row.selected)}
                              disabled={row.hasInvalidQuantity || insufficient}
                              title={
                                row.hasInvalidQuantity
                                  ? "Invalid quantity"
                                  : insufficient
                                    ? "Excel quantity is greater than available quantity"
                                    : "Select row"
                              }
                              className={`w-5 h-5 rounded-md border flex items-center justify-center mx-auto transition-colors ${
                                row.selected && !insufficient && !row.hasInvalidQuantity
                                  ? "bg-teal-600 border-teal-600 text-white"
                                  : "bg-white border-slate-300 text-transparent"
                              } ${row.hasInvalidQuantity || insufficient ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                              <Check size={13}/>
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{row.sourceName}</td>
                          <td className="px-4 py-3 text-emerald-700 font-semibold">{itemNameById[row.matchedItemId]}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{daysFilled}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${insufficient && hasQty ? "text-red-600" : "text-slate-700"}`}>{formatQty(total)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${insufficient && hasQty ? "text-red-600" : "text-slate-700"}`}>{formatQty(available)}</td>
                          <td className="px-4 py-3">{row.hasInvalidQuantity ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg">Invalid quantity</span> : insufficient && hasQty ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg">Insufficient stock</span> : <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Matched</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {unmatchedRows.length > 0 && (
              <section>
                <div className="mb-3"><h3 className="font-bold text-slate-800 text-sm">Items Not Matching</h3><p className="text-xs text-slate-400 mt-0.5">Use the last column to map each Excel item to an Item Master item. Once matched, it moves into the matched list.</p></div>
                <div className="border border-amber-100 rounded-2xl overflow-auto max-h-[460px]">
                  <table className="w-full min-w-[950px] text-sm">
                    <thead className="sticky top-0 z-10 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs uppercase tracking-wide">
                      <tr><th className="px-4 py-3 text-left">Excel Row</th><th className="px-4 py-3 text-left">Excel Item</th><th className="px-4 py-3 text-center">Days Filled</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-left">Match With Item Master</th></tr>
                    </thead>
                    <tbody>
                      {unmatchedRows.map((row) => {
                        const daysFilled = Object.keys(row.quantities).length;
                        const total = Object.values(row.quantities).reduce((sum, qty) => sum + Number(qty), 0);
                        const options = availableMatchItems(row);
                        return (
                          <tr key={row._rowNum} className="border-b border-amber-50 hover:bg-amber-50/30">
                            <td className="px-4 py-3 text-slate-400 text-xs">{row._rowNum}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{row.sourceName || "—"}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{daysFilled}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatQty(total)}</td>
                            <td className="px-4 py-3">
                              <div className="relative"><select value={row.matchManually || ""} onChange={(e) => setManualMatch(row._rowNum, e.target.value)} className="w-full appearance-none px-3 py-2.5 pr-9 rounded-xl border border-amber-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"><option value="">— Select Item to Match —</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className={`rounded-2xl p-5 flex items-start gap-4 ${importResult.errors?.length ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
          {importResult.errors?.length ? <AlertTriangle size={28} className="text-amber-500 shrink-0"/> : <CheckCircle size={28} className="text-emerald-500 shrink-0"/>}
          <div className="min-w-0"><p className="font-bold text-slate-800">{importResult.errors?.length ? "Import Needs Attention" : "Import Complete!"}</p>{importResult.errors?.length ? <div className="text-sm text-slate-600 mt-1 space-y-1 max-h-40 overflow-auto">{importResult.errors.slice(0, 20).map((error, index) => <p key={index}>• {error}</p>)}{importResult.errors.length > 20 && <p>• …and {importResult.errors.length - 20} more</p>}</div> : <p className="text-sm text-slate-600 mt-0.5">{importResult.success} daily consumption entries were added to Firebase.</p>}</div>
          <button onClick={() => setImportResult(null)} className="ml-auto p-1.5 rounded-lg hover:bg-black/5 text-slate-400 shrink-0"><X size={15}/></button>
        </div>
      )}

      {parsedRows.length === 0 && !importResult && <div className="bg-white rounded-2xl border border-slate-100 shadow-sm"><Empty icon={FileSpreadsheet} title="No file uploaded yet" sub="Download the consumption template, fill the day columns, then upload it here"/></div>}
    </div>
  );
}