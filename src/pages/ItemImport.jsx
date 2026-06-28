import { useState, useRef } from "react";
import ExcelJS from "exceljs";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Toast, useToast, PrimaryBtn, Empty } from "../components/ui";

const HEADERS = [
  "Item Name", "Category", "Unit", "Min Stock Level",
  "Has Secondary Unit", "Secondary Unit", "Primary Qty For Conversion", "Secondary Qty For Conversion",
];

export default function ItemImport({ items, categories, units, addItem }) {
  const [parsedRows,   setParsedRows]   = useState([]);
  const [fileName,     setFileName]     = useState("");
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, showToast] = useToast();
  const fileInputRef = useRef(null);

  const activeCategories = categories.filter(c => c.active !== false).map(c => c.name);
  const activeUnits      = units.filter(u => u.active !== false).map(u => u.name);

  const validCategories  = new Set(activeCategories.map(c => c.toLowerCase()));
  const validUnits       = new Set(activeUnits.map(u => u.toLowerCase()));
  const existingItemNames = new Set(items.map(i => i.name.toLowerCase()));

  // ── Download template with REAL in-cell dropdowns ────────────
  const downloadTemplate = async () => {
    if (activeCategories.length === 0 || activeUnits.length === 0) {
      showToast("Add at least one Category and Unit in Admin Panel first", "error");
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Items");

    // Header row
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F1EE" } };
    HEADERS.forEach((h, i) => { ws.getColumn(i + 1).width = Math.max(h.length + 4, 20); });

    // Sample row for guidance
    ws.addRow(["Ghee", activeCategories[0], activeUnits[0], "5", "Yes", activeUnits[1] || activeUnits[0], "1", "15"]);
    ws.addRow(["Paracetamol 500mg", activeCategories[0], activeUnits[0], "20", "No", "", "", ""]);

    // Apply dropdown validations to rows 2-200 (covers plenty of items)
    const categoryList = `"${activeCategories.join(",")}"`;
    const unitList      = `"${activeUnits.join(",")}"`;
    const yesNoList     = `"Yes,No"`;

    for (let r = 2; r <= 200; r++) {
      ws.getCell(`B${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [categoryList],
        showErrorMessage: true, errorTitle: "Invalid Category",
        error: "Please select a category from the dropdown list.",
      };
      ws.getCell(`C${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [unitList],
        showErrorMessage: true, errorTitle: "Invalid Unit",
        error: "Please select a unit from the dropdown list.",
      };
      ws.getCell(`E${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [yesNoList],
        showErrorMessage: true, errorTitle: "Invalid Value",
        error: "Please select Yes or No.",
      };
      ws.getCell(`F${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [unitList],
        showErrorMessage: true, errorTitle: "Invalid Unit",
        error: "Please select a unit from the dropdown list.",
      };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "InvenPro_Item_Import_Template.xlsx";
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
        const values = HEADERS.map((_, i) => {
          const cell = row.getCell(i + 1);
          return cell.value != null ? String(cell.value).trim() : "";
        });
        if (values.some(v => v !== "")) {
          dataRows.push({ rowNumber, values });
        }
      });

      const validated = dataRows.map(({ rowNumber, values }) => validateRow(values, rowNumber));
      setParsedRows(validated);
    } catch (err) {
      console.error(err);
      showToast("Could not read file — make sure it's a valid .xlsx", "error");
      setParsedRows([]);
    }
  };

  const validateRow = (r, rowNumber) => {
    const [name, category, unit, minStock, hasSecRaw, secUnit, primaryQty, secondaryQty] = r;
    const errors = [];

    if (!name) errors.push("Item Name is required");
    else if (existingItemNames.has(name.toLowerCase())) errors.push("Item already exists — will be skipped");

    if (!category) errors.push("Category is required");
    else if (!validCategories.has(category.toLowerCase())) errors.push(`Category "${category}" not in Admin Panel`);

    if (!unit) errors.push("Unit is required");
    else if (!validUnits.has(unit.toLowerCase())) errors.push(`Unit "${unit}" not in Admin Panel`);

    const hasSecondaryUnit = hasSecRaw.toLowerCase() === "yes";
    if (hasSecondaryUnit) {
      if (!secUnit) errors.push("Secondary Unit required when Has Secondary Unit = Yes");
      else if (!validUnits.has(secUnit.toLowerCase())) errors.push(`Secondary Unit "${secUnit}" not in Admin Panel`);
      if (!primaryQty || isNaN(Number(primaryQty))) errors.push("Primary Qty For Conversion must be a number");
      if (!secondaryQty || isNaN(Number(secondaryQty))) errors.push("Secondary Qty For Conversion must be a number");
    }

    if (minStock && isNaN(Number(minStock))) errors.push("Min Stock Level must be a number");

    return {
      _rowNum: rowNumber,
      name, category, unit,
      minStockLevel: minStock,
      hasSecondaryUnit,
      secondaryUnit: hasSecondaryUnit ? secUnit : "",
      primaryQty: hasSecondaryUnit ? primaryQty : "",
      secondaryQty: hasSecondaryUnit ? secondaryQty : "",
      _errors: errors,
      _valid: errors.length === 0,
      _duplicate: existingItemNames.has(name.toLowerCase()),
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
        await addItem({
          name: row.name,
          category: row.category,
          unit: row.unit,
          minStockLevel: row.minStockLevel || "",
          description: "",
          hasSecondaryUnit: row.hasSecondaryUnit,
          secondaryUnit: row.secondaryUnit,
          conversionRate: row.hasSecondaryUnit
            ? Number(row.secondaryQty) / Number(row.primaryQty)
            : 0,
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
    showToast(`Imported ${success} item${success !== 1 ? "s" : ""}!`);
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
          <FileSpreadsheet size={24} className="text-teal-600"/> Import Items
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Bulk add items using an Excel template with dropdowns</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-slate-800 text-sm">Step 1 — Download Template</p>
            <p className="text-slate-500 text-xs mt-1">
              Category, Unit, Has Secondary Unit, and Secondary Unit columns have real dropdown arrows in Excel
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
                {importing ? "Importing…" : `Import ${validRows.length} Item${validRows.length !== 1 ? "s" : ""}`}
              </PrimaryBtn>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wide sticky top-0">
                  {["Row","Status","Name","Category","Unit","Min Stock","Secondary","Issues"].map(h=>(
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
                    <td className="px-4 py-2.5 font-medium text-slate-700">{row.name || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.category || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.unit || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.minStockLevel || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {row.hasSecondaryUnit ? `${row.primaryQty} ${row.unit} = ${row.secondaryQty} ${row.secondaryUnit}` : "—"}
                    </td>
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
              {importResult.success} item{importResult.success !== 1 ? "s" : ""} added successfully
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
