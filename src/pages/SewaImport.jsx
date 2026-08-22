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

const HEADERS = ["Date", "Item", "Name", "Qty", "Rate", "Amount"];

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const getCellText = (value) => {
  if (value == null) return "";
  if (typeof value === "object" && value.result != null) {
    return getCellText(value.result);
  }
  return String(value).trim();
};

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
};

const formatDate = (value) => {
  if (!value) return "";

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN");
};

const parseExcelDate = (value) => {
  if (value instanceof Date) return value;

  if (typeof value === "number") {
    // Excel serial date.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(
      excelEpoch.getTime() + value * 24 * 60 * 60 * 1000
    );
  }

  if (typeof value === "object" && value?.result != null) {
    return parseExcelDate(value.result);
  }

  const text = String(value || "").trim();
  if (!text) return null;

  // dd/mm/yyyy or dd-mm-yyyy
  const parts = text.split(/[\/-]/).map((x) => x.trim());

  if (parts.length === 3 && parts[0].length <= 2) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);

    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export default function SewaImport({
  items,
  events,
  addEntriesBatch,
}) {
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, showToast] = useToast();

  const fileInputRef = useRef(null);

  const activeItems = useMemo(
    () => (items || []).filter((item) => item.active !== false),
    [items]
  );

  const itemMap = useMemo(
    () =>
      Object.fromEntries(
        activeItems.map((item) => [normalizeName(item.name), item])
      ),
    [activeItems]
  );

  const itemNameById = useMemo(
    () =>
      Object.fromEntries(
        activeItems.map((item) => [item.id, item.name])
      ),
    [activeItems]
  );

  // Sewa is automatically selected. No event dropdown is required.
  const sewaEvent = useMemo(
    () =>
      (events || []).find(
        (event) =>
          normalizeName(event.name || event.eventName) === "sewa" &&
          event.active !== false
      ),
    [events]
  );

  const matchedRows = parsedRows.filter((row) => row.matchedItemId);
  const unmatchedRows = parsedRows.filter((row) => !row.matchedItemId);

  const selectedRows = parsedRows.filter(
    (row) =>
      row.matchedItemId &&
      row.selected &&
      !row.hasInvalidData
  );

  const checkedCount = selectedRows.length;

  const groupedMatchedRows = useMemo(() => {
    const groups = new Map();

    matchedRows.forEach((row) => {
      const key = `${dateKey(row.date)}__${normalizeName(row.name)}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date: row.date,
          name: row.name,
          rows: [],
          selected: true,
        });
      }

      const group = groups.get(key);
      group.rows.push(row);
      group.selected = group.selected && row.selected;
    });

    return Array.from(groups.values());
  }, [matchedRows]);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "InvenPro";

    const ws = wb.addWorksheet("Sewa");
    const listWs = wb.addWorksheet("Lists");

    listWs.state = "veryHidden";

    ws.addRow(HEADERS);

    ws.getRow(1).font = {
      bold: true,
      color: { argb: "FF0F172A" },
    };

    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2F1EE" },
    };

    ws.getRow(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 28;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 16;

    ws.freezePanes = "A2";
    ws.autoFilter = "A1:F101";

    for (let row = 2; row <= 101; row++) {
      ws.getCell(row, 1).numFmt = "dd/mm/yyyy";

      ws.getCell(row, 4).dataValidation = {
        type: "decimal",
        allowBlank: true,
        operator: "greaterThanOrEqual",
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid Quantity",
        error: "Qty must be a number greater than or equal to 0.",
      };

      ws.getCell(row, 5).dataValidation = {
        type: "decimal",
        allowBlank: true,
        operator: "greaterThanOrEqual",
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid Rate",
        error: "Rate must be a number greater than or equal to 0.",
      };

      ws.getCell(row, 6).dataValidation = {
        type: "decimal",
        allowBlank: true,
        operator: "greaterThanOrEqual",
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid Amount",
        error: "Amount must be a number greater than or equal to 0.",
      };
    }

    listWs.getCell("A1").value = "Items";

    activeItems.forEach((item, index) => {
      listWs.getCell(`A${index + 2}`).value = item.name;
    });

    const buffer = await wb.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "InvenPro_Sewa_Template.xlsx";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showToast("Sewa template downloaded");
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

      if (!ws) {
        throw new Error("No worksheet found");
      }

      const actualHeaders = HEADERS.map((_, index) =>
        normalizeName(getCellText(ws.getCell(1, index + 1).value))
      );

      const expectedHeaders = HEADERS.map(normalizeName);

      const validHeaders = expectedHeaders.every(
        (header, index) => actualHeaders[index] === header
      );

      if (!validHeaders) {
        throw new Error(
          `Invalid template. Required columns are: ${HEADERS.join(", ")}.`
        );
      }

      const rows = [];

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const date = parseExcelDate(row.getCell(1).value);
        const sourceItem = getCellText(row.getCell(2).value);
        const name = getCellText(row.getCell(3).value);

        const qty = toNumber(row.getCell(4).value);
        const rate = toNumber(row.getCell(5).value);
        const enteredAmount = toNumber(row.getCell(6).value);

        const completelyEmpty =
          !date &&
          !sourceItem &&
          !name &&
          row.getCell(4).value == null &&
          row.getCell(5).value == null &&
          row.getCell(6).value == null;

        if (completelyEmpty) return;

        const matchedItem =
          itemMap[normalizeName(sourceItem)] || null;

        const calculatedAmount =
          Number.isFinite(qty) && Number.isFinite(rate)
            ? qty * rate
            : NaN;

        const amount =
          Number.isFinite(enteredAmount)
            ? enteredAmount
            : calculatedAmount;

        const hasInvalidData =
          !date ||
          !sourceItem ||
          !name ||
          !Number.isFinite(qty) ||
          qty < 0 ||
          !Number.isFinite(rate) ||
          rate < 0 ||
          !Number.isFinite(amount) ||
          amount < 0;

        rows.push({
          _rowNum: rowNumber,
          date,
          sourceItem,
          name,
          qty,
          rate,
          amount,
          matchedItemId: matchedItem?.id || "",
          matchManually: "",
          selected: Boolean(matchedItem) && !hasInvalidData,
          hasInvalidData,
        });
      });

      setParsedRows(rows);

      if (rows.length === 0) {
        showToast("No Sewa rows found in the uploaded file", "error");
      }
    } catch (error) {
      console.error(error);

      showToast(
        error.message || "Could not read the Excel file",
        "error"
      );

      setParsedRows([]);
    }
  };

  const setRowSelected = (rowNumber, selected) => {
    setParsedRows((prev) =>
      prev.map((row) =>
        row._rowNum === rowNumber
          ? { ...row, selected }
          : row
      )
    );
  };

  const setManualMatch = (rowNumber, itemId) => {
    setParsedRows((prev) =>
      prev.map((row) =>
        row._rowNum === rowNumber
          ? {
              ...row,
              matchedItemId: itemId,
              matchManually: itemId,
              selected: Boolean(itemId) && !row.hasInvalidData,
            }
          : row
      )
    );
  };

  const availableMatchItems = (currentRow) => {
    const usedByOtherRows = new Set(
      parsedRows
        .filter(
          (row) =>
            row._rowNum !== currentRow._rowNum &&
            row.matchedItemId
        )
        .map((row) => row.matchedItemId)
    );

    return activeItems.filter(
      (item) => !usedByOtherRows.has(item.id)
    );
  };

  const toggleGroup = (group, selected) => {
    const rowNumbers = new Set(
      group.rows.map((row) => row._rowNum)
    );

    setParsedRows((prev) =>
      prev.map((row) =>
        rowNumbers.has(row._rowNum)
          ? {
              ...row,
              selected: selected && !row.hasInvalidData,
            }
          : row
      )
    );
  };

  const handleImport = async () => {
    if (!sewaEvent) {
      showToast(
        'Event "Sewa" was not found or is inactive.',
        "error"
      );
      return;
    }

    if (checkedCount === 0) {
      showToast("Select at least one valid Sewa row", "error");
      return;
    }

    setImporting(true);

    try {
      /*
       * One Firebase entry is created for each Date + Name.
       *
       * Example:
       *
       * 20/08/2026 | Item A | Ramesh | 2 | 100 | 200
       * 20/08/2026 | Item B | Ramesh | 3 |  50 | 150
       *
       * becomes ONE entry:
       *   name = Ramesh
       *   rows = [Item A, Item B]
       */
      const groups = new Map();

      selectedRows.forEach((row) => {
        const key = `${dateKey(row.date)}__${normalizeName(row.name)}`;

        if (!groups.has(key)) {
          groups.set(key, {
            date: row.date,
            name: row.name,
            rows: [],
          });
        }

        groups.get(key).rows.push({
          itemId: row.matchedItemId,
          batchId: row.batchId || null,
          qty: formatNumber(row.qty),
          rate: formatNumber(row.rate),
          amount: formatNumber(row.amount),
        });
      });

      const payloads = Array.from(groups.values()).map((group) => ({
        date: group.date,
        eventId: sewaEvent.id,
        docNo: `Sewa Import - ${dateKey(group.date)}`,
        ledgerId: "",
        ledgerOtherName: group.name,
        rows: group.rows,
      }));

      await addEntriesBatch(payloads);

      setImportResult({
        success: selectedRows.length,
        entries: payloads.length,
        failed: 0,
        errors: [],
      });

      setParsedRows([]);
      setFileName("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      showToast(
        `Imported ${selectedRows.length} Sewa item row${
          selectedRows.length !== 1 ? "s" : ""
        } into ${payloads.length} entr${
          payloads.length !== 1 ? "ies" : "y"
        }`
      );
    } catch (error) {
      console.error(error);

      showToast(
        error.message || "Error importing Sewa",
        "error"
      );
    } finally {
      setImporting(false);
    }
  };

  const resetUpload = () => {
    setParsedRows([]);
    setFileName("");
    setImportResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-slate-800 flex items-center gap-2"
            style={{ fontFamily: "'Syne',sans-serif" }}
          >
            <FileSpreadsheet size={24} className="text-teal-600" />
            Import Sewa
          </h1>

          <p className="text-slate-500 text-sm mt-0.5">
            Import Sewa transactions from Excel. Multiple items for the
            same person on the same date are saved as one entry.
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors whitespace-nowrap"
        >
          <Download size={15} />
          Download Template
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-800 text-sm">
          Excel Format
        </p>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
          {HEADERS.map((header) => (
            <div
              key={header}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600"
            >
              {header}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          If Amount is blank, it is automatically calculated as Qty × Rate.
          Item names are matched against Item Master.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-800 text-sm mb-1">
          Upload Sewa Excel
        </p>

        <p className="text-slate-500 text-xs mb-4">
          Exact item names are matched automatically. Unmatched items can
          be mapped manually.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer">
          <Upload size={24} className="text-slate-400" />

          <span className="text-sm font-semibold text-slate-600">
            {fileName || "Click to select your .xlsx file"}
          </span>

          <span className="text-xs text-slate-400">
            Sewa template only
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Review Sewa
              </p>

              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-emerald-600 font-semibold">
                  {matchedRows.length} matched
                </span>
                {" · "}
                <span className="text-amber-600 font-semibold">
                  {unmatchedRows.length} unmatched
                </span>
                {" · "}
                <span className="text-teal-600 font-semibold">
                  {checkedCount} selected
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={resetUpload}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleImport}
                disabled={
                  importing ||
                  checkedCount === 0 ||
                  !sewaEvent
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle size={15} />
                )}

                {importing
                  ? "Importing…"
                  : `Import ${checkedCount}`}
              </button>
            </div>
          </div>

          {!sewaEvent && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Event <strong>Sewa</strong> was not found or is inactive.
              </span>
            </div>
          )}

          <div className="p-5 space-y-6">
            {groupedMatchedRows.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Matched Sewa
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Same person + same date is grouped into one Firebase
                      entry.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setParsedRows((prev) =>
                        prev.map((row) =>
                          row.matchedItemId && !row.hasInvalidData
                            ? { ...row, selected: true }
                            : row
                        )
                      )
                    }
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    Select All
                  </button>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-auto max-h-[520px]">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="w-12 px-4 py-3 text-center">✓</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Items</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {groupedMatchedRows.map((group) => {
                        const totalQty = group.rows.reduce(
                          (sum, row) => sum + (Number(row.qty) || 0),
                          0
                        );

                        const totalAmount = group.rows.reduce(
                          (sum, row) => sum + (Number(row.amount) || 0),
                          0
                        );

                        const hasInvalid = group.rows.some(
                          (row) => row.hasInvalidData
                        );

                        const allSelected = group.rows.every(
                          (row) => row.selected
                        );

                        return (
                          <tr
                            key={group.key}
                            className="border-b border-slate-50 hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-3 text-center">
                              <button
                                disabled={hasInvalid}
                                onClick={() =>
                                  toggleGroup(
                                    group,
                                    !allSelected
                                  )
                                }
                                className={`w-5 h-5 rounded-md border flex items-center justify-center mx-auto ${
                                  allSelected
                                    ? "bg-teal-600 border-teal-600 text-white"
                                    : "bg-white border-slate-300 text-transparent"
                                } ${
                                  hasInvalid
                                    ? "opacity-40 cursor-not-allowed"
                                    : ""
                                }`}
                              >
                                <Check size={13} />
                              </button>
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-700">
                              {formatDate(group.date)}
                            </td>

                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {group.name}
                            </td>

                            <td className="px-4 py-3">
                              <div className="space-y-1.5">
                                {group.rows.map((row) => (
                                  <div
                                    key={row._rowNum}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="text-emerald-700 font-semibold">
                                      {itemNameById[row.matchedItemId]}
                                    </span>

                                    <span className="text-xs text-slate-500">
                                      {formatNumber(row.qty)} ×{" "}
                                      {formatNumber(row.rate)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-slate-700">
                              {formatNumber(totalQty)}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-slate-700">
                              {formatNumber(totalAmount)}
                            </td>

                            <td className="px-4 py-3">
                              {hasInvalid ? (
                                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                  Invalid data
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                  Matched
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {unmatchedRows.length > 0 && (
              <section>
                <div className="mb-3">
                  <h3 className="font-bold text-slate-800 text-sm">
                    Items Not Matching
                  </h3>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Select the correct Item Master item in the last column.
                  </p>
                </div>

                <div className="border border-amber-100 rounded-2xl overflow-auto max-h-[460px]">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="sticky top-0 z-10 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-center">✓</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Excel Item</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-left">
                          Match With Item Master
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {unmatchedRows.map((row) => (
                        <tr
                          key={row._rowNum}
                          className="border-b border-amber-50 hover:bg-amber-50/30"
                        >
                          <td className="px-4 py-3 text-center">
                            <button
                              disabled={
                                !row.matchedItemId ||
                                row.hasInvalidData
                              }
                              onClick={() =>
                                setRowSelected(
                                  row._rowNum,
                                  !row.selected
                                )
                              }
                              className={`w-5 h-5 rounded-md border flex items-center justify-center mx-auto ${
                                row.selected
                                  ? "bg-teal-600 border-teal-600 text-white"
                                  : "bg-white border-slate-300 text-transparent"
                              }`}
                            >
                              <Check size={13} />
                            </button>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(row.date) || "—"}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {row.sourceItem || "—"}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {row.name || "—"}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {formatNumber(row.qty)}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatNumber(row.rate)}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatNumber(row.amount)}
                          </td>

                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={row.matchManually || ""}
                                onChange={(e) =>
                                  setManualMatch(
                                    row._rowNum,
                                    e.target.value
                                  )
                                }
                                className="w-full appearance-none px-3 py-2.5 pr-9 rounded-xl border border-amber-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                              >
                                <option value="">
                                  — Select Item to Match —
                                </option>

                                {availableMatchItems(row).map((item) => (
                                  <option
                                    key={item.id}
                                    value={item.id}
                                  >
                                    {item.name}
                                  </option>
                                ))}
                              </select>

                              <ChevronDown
                                size={15}
                                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200 flex items-start gap-4">
          <CheckCircle
            size={28}
            className="text-emerald-500 shrink-0"
          />

          <div>
            <p className="font-bold text-slate-800">
              Import Complete
            </p>

            <p className="text-sm text-slate-600 mt-0.5">
              {importResult.success} item row
              {importResult.success !== 1 ? "s" : ""} imported into{" "}
              {importResult.entries} Firebase entr
              {importResult.entries !== 1 ? "ies" : "y"}.
            </p>
          </div>

          <button
            onClick={() => setImportResult(null)}
            className="ml-auto p-1.5 rounded-lg hover:bg-black/5 text-slate-400"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {parsedRows.length === 0 && !importResult && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Empty
            icon={FileSpreadsheet}
            title="No file uploaded yet"
            sub="Download the Sewa template, fill it, then upload it here"
          />
        </div>
      )}
    </div>
  );
}