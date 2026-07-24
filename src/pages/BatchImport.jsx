import { useState, useRef } from "react";
import ExcelJS from "exceljs";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Toast, useToast, PrimaryBtn, Empty } from "../components/ui";

const HEADERS = [
  "Item Name", "Batch Number", "Expiry Date", "Opening Qty", "Purchase Price", "MRP", "Supplier",
];

// Convert an Excel serial date number to a JS Date (fallback for cells ExcelJS
// doesn't auto-parse as dates).
function excelSerialToDate(n) {
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
}

function parseDateCell(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "object" && raw.result != null) return parseDateCell(raw.result);
  if (typeof raw === "number") return excelSerialToDate(raw);
  const s = String(raw).trim();
  if (!s) return null;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const fmtDateForForm = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function BatchImport({ items, batches, ledger, addBatch }) {
  const [parsedRows,   setParsedRows]   = useState([]);
  const [fileName,     setFileName]     = useState("");
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, showToast] = useToast();
  const fileInputRef = useRef(null);

  const activeItemNames = items.map(i => i.name);
  const supplierNames   = ledger.map(l => l.name);

  const itemByName     = new Map(items.map(i => [i.name.toLowerCase(), i]));
  const supplierByName = new Map(ledger.map(l => [l.name.toLowerCase(), l]));
  const existingBatchKeys = new Set(batches.map(b => `${b.itemId}::${(b.batchNo || "").toLowerCase()}`));

  // ── Download template with REAL in-cell dropdowns ────────────
  const downloadTemplate = async () => {
    if (activeItemNames.length === 0) {
      showToast("Add at least one Item in Item Master first", "error");
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Batches");

    // Hidden helper sheet holding the lookup lists (keeps dropdowns working
    // even with large item counts / names containing commas).
    const listWs = wb.addWorksheet("Lists");
    listWs.state = "veryHidden";
    listWs.getCell("A1").value = "Items";
    activeItemNames.forEach((name, i) => { listWs.getCell(`A${i + 2}`).value = name; });
    listWs.getCell("B1").value = "Suppliers";
    supplierNames.forEach((name, i) => { listWs.getCell(`B${i + 2}`).value = name; });

    wb.definedNames.add(`Lists!$A$2:$A$${activeItemNames.length + 1}`, "ItemList");
    if (supplierNames.length > 0) {
      wb.definedNames.add(`Lists!$B$2:$B$${supplierNames.length + 1}`, "SupplierList");
    }

    // Header row
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F1EE" } };
    HEADERS.forEach((h, i) => { ws.getColumn(i + 1).width = Math.max(h.length + 4, 18); });
    ws.getColumn(3).numFmt = "dd-mmm-yyyy"; // Expiry Date column

    // Sample row for guidance
    const sampleDate = new Date();
    sampleDate.setMonth(sampleDate.getMonth() + 6);
    ws.addRow([activeItemNames[0], "B2024-001", sampleDate, 100, 45.5, 60, supplierNames[0] || ""]);

    // Apply dropdown + type validations to rows 2-300
    for (let r = 2; r <= 300; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: ["ItemList"],
        showErrorMessage: true, errorTitle: "Invalid Item",
        error: "Please select an item from the dropdown list.",
      };
      ws.getCell(`C${r}`).dataValidation = {
        type: "date", allowBlank: true,
        operator: "greaterThan", formulae: [new Date(2000, 0, 1)],
        showErrorMessage: true, errorTitle: "Invalid Date",
        error: "Please enter a valid expiry date.",
      };
      ws.getCell(`D${r}`).dataValidation = {
        type: "decimal", allowBlank: true, operator: "greaterThanOrEqual", formulae: [0],
        showErrorMessage: true, errorTitle: "Invalid Quantity",
        error: "Opening Qty must be a number ≥ 0.",
      };
      ws.getCell(`E${r}`).dataValidation = {
        type: "decimal", allowBlank: true, operator: "greaterThanOrEqual", formulae: [0],
        showErrorMessage: true, errorTitle: "Invalid Price",
        error: "Purchase Price must be a number ≥ 0.",
      };
      ws.getCell(`F${r}`).dataValidation = {
        type: "decimal", allowBlank: true, operator: "greaterThanOrEqual", formulae: [0],
        showErrorMessage: true, errorTitle: "Invalid MRP",
        error: "MRP must be a number ≥ 0.",
      };
      if (supplierNames.length > 0) {
        ws.getCell(`G${r}`).dataValidation = {
          type: "list", allowBlank: true, formulae: ["SupplierList"],
          showErrorMessage: true, errorTitle: "Invalid Supplier",
          error: "Please select a supplier from the dropdown list.",
        };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "InvenPro_Batch_Import_Template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Template downloaded with dropdowns!");
  };

  // ── Parse uploaded file ──────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    try {
      const wb = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];

      const dataRows = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const itemName   = row.getCell(1).value != null ? String(row.getCell(1).value).trim() : "";
        const batchNo     = row.getCell(2).value != null ? String(row.getCell(2).value).trim() : "";
        const expiryDate  = parseDateCell(row.getCell(3).value);
        const quantityRaw = row.getCell(4).value;
        const purchaseRaw = row.getCell(5).value;
        const mrpRaw      = row.getCell(6).value;
        const supplierName = row.getCell(7).value != null ? String(row.getCell(7).value).trim() : "";

        const rowIsEmpty = !itemName && !batchNo && !expiryDate && quantityRaw == null && purchaseRaw == null && mrpRaw == null && !supplierName;
        if (!rowIsEmpty) {
          dataRows.push({
            rowNumber, itemName, batchNo, expiryDate,
            quantityRaw, purchaseRaw, mrpRaw, supplierName,
          });
        }
      });

      const validated = dataRows.map(validateRow);
      setParsedRows(validated);
    } catch (err) {
      console.error(err);
      showToast("Could not read file — make sure it's a valid .xlsx", "error");
      setParsedRows([]);
    }
  };

  const validateRow = (r) => {
    const { rowNumber, itemName, batchNo, expiryDate, quantityRaw, purchaseRaw, mrpRaw, supplierName } = r;
    const errors = [];

    const item = itemName ? itemByName.get(itemName.toLowerCase()) : null;
    if (!itemName) errors.push("Item Name is required");
    else if (!item) errors.push(`Item "${itemName}" not found in Item Master`);

    if (!batchNo) errors.push("Batch Number is required");

    if (!expiryDate) errors.push("Expiry Date is required / invalid");

    const quantity = quantityRaw != null && quantityRaw !== "" ? Number(quantityRaw) : NaN;
    if (quantityRaw == null || quantityRaw === "") errors.push("Opening Qty is required");
    else if (isNaN(quantity) || quantity < 0) errors.push("Opening Qty must be a number ≥ 0");

    const purchasePrice = purchaseRaw != null && purchaseRaw !== "" ? Number(purchaseRaw) : "";
    if (purchasePrice !== "" && isNaN(purchasePrice)) errors.push("Purchase Price must be a number");

    const mrp = mrpRaw != null && mrpRaw !== "" ? Number(mrpRaw) : "";
    if (mrp !== "" && isNaN(mrp)) errors.push("MRP must be a number");

    let supplier = null;
    if (supplierName) {
      supplier = supplierByName.get(supplierName.toLowerCase());
      if (!supplier) errors.push(`Supplier "${supplierName}" not found in Ledger Master`);
    }

    const dupKey = item && batchNo ? `${item.id}::${batchNo.toLowerCase()}` : null;
    const isDuplicate = dupKey ? existingBatchKeys.has(dupKey) : false;
    if (isDuplicate) errors.push("Batch already exists for this item — will be skipped");

    return {
      _rowNum: rowNumber,
      itemName, itemId: item?.id || "",
      batchNo,
      expiryDate,
      quantity: quantityRaw != null && quantityRaw !== "" ? String(quantityRaw) : "",
      purchasePrice: purchasePrice === "" ? "" : String(purchasePrice),
      mrp: mrp === "" ? "" : String(mrp),
      supplierName, supplierId: supplier?.id || "",
      _errors: errors,
      _valid: errors.length === 0,
      _duplicate: isDuplicate,
      _unit: item?.unit || "",
    };
  };

  const validRows   = parsedRows.filter(r => r._valid && !r._duplicate);
  const invalidRows = parsedRows.filter(r => !r._valid || r._duplicate);

  // ── Import valid rows ────────────────────────────────────────
  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let success = 0, failed = 0;

    for (const row of validRows) {
      try {
        await addBatch({
          itemId: row.itemId,
          batchNo: row.batchNo,
          expiryDate: fmtDateForForm(row.expiryDate),
          quantity: row.quantity,
          purchasePrice: row.purchasePrice,
          mrp: row.mrp,
          supplierId: row.supplierId,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    setParsedRows([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast(`Imported ${success} batch${success !== 1 ? "es" : ""}!`);
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

      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" style={{fontFamily:"'Syne',sans-serif"}}>
          <FileSpreadsheet size={24} className="text-teal-600"/> Import Batches
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Bulk add batches using an Excel template with dropdowns</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        💡 <strong>Opening Qty</strong> imported here is frozen the same way as batches added manually. Current stock is still calculated live from Entry Sheet transactions.
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-slate-800 text-sm">Step 1 — Download Template</p>
            <p className="text-slate-500 text-xs mt-1">
              Item Name and Supplier columns have real dropdown arrows in Excel; Expiry Date is a proper date column
            </p>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors whitespace-nowrap">
            <Download size={15}/> Download Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-slate-800 text-sm mb-1">Step 2 — Upload Filled Template</p>
        <p className="text-slate-500 text-xs mb-4">Fill the template using the dropdowns, then upload it here</p>

        <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200
          hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer">
          <Upload size={24} className="text-slate-400"/>
          <span className="text-sm font-semibold text-slate-600">
            {fileName || "Click to select your .xlsx file"}
          </span>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden"/>
        </label>
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 text-sm">Step 3 — Review ({parsedRows.length} rows found)</p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-emerald-600 font-semibold">{validRows.length} valid</span>
                {invalidRows.length > 0 && <> · <span className="text-red-500 font-semibold">{invalidRows.length} need fixing</span></>}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={resetUpload}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <PrimaryBtn onClick={handleImport} disabled={validRows.length === 0 || importing}>
                {importing ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>}
                {importing ? "Importing…" : `Import ${validRows.length} Batch${validRows.length !== 1 ? "es" : ""}`}
              </PrimaryBtn>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide sticky top-0">
                  {["Row","Status","Item","Batch No.","Expiry","Opening Qty","Purchase ₹","MRP ₹","Supplier","Issues"].map(h=>(
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row) => (
                  <tr key={row._rowNum} className={`border-b border-slate-50 ${!row._valid || row._duplicate ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{row._rowNum}</td>
                    <td className="px-4 py-2.5">
                      {row._valid && !row._duplicate
                        ? <CheckCircle size={15} className="text-emerald-500"/>
                        : <XCircle size={15} className="text-red-500"/>
                      }
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{row.itemName || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-teal-700 text-xs">{row.batchNo || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {row.expiryDate ? row.expiryDate.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{row.quantity ? `${row.quantity} ${row._unit}` : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.purchasePrice !== "" ? `₹${row.purchasePrice}` : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.mrp !== "" ? `₹${row.mrp}` : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{row.supplierName || "—"}</td>
                    <td className="px-4 py-2.5">
                      {row._errors.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {row._errors.map((err, i) => (
                            <span key={i} className="text-xs text-red-500 flex items-center gap-1">
                              <AlertTriangle size={10}/> {err}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
          <CheckCircle size={28} className="text-emerald-500 shrink-0"/>
          <div>
            <p className="font-bold text-slate-800">Import Complete!</p>
            <p className="text-sm text-slate-600 mt-0.5">
              {importResult.success} batch{importResult.success !== 1 ? "es" : ""} added successfully
              {importResult.failed > 0 && <span className="text-red-500"> · {importResult.failed} failed</span>}
            </p>
          </div>
        </div>
      )}

      {parsedRows.length === 0 && !importResult && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Empty icon={FileSpreadsheet} title="No file uploaded yet" sub="Download the template, fill it in using the dropdowns, then upload above"/>
        </div>
      )}
    </div>
  );
}
