const admin      = require("firebase-admin");
const nodemailer = require("nodemailer");

// ── Firebase Admin init ───────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ── Gmail transporter ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,   // 16-digit App Password
  },
});

// ── Recipients ────────────────────────────────────────────────
// GitHub secret format: Owner:email1,Manager:email2,Staff:email3
const RECIPIENTS = process.env.ALERT_EMAILS
  .split(",")
  .map((entry) => {
    const [name, email] = entry.split(":");
    return { name: name.trim(), email: email.trim() };
  });

// ── Helpers ───────────────────────────────────────────────────
const fmtDate  = (d) => d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
const daysLeft = (d) => Math.ceil((d - new Date()) / 864e5);

// ── Fetch Firestore data ──────────────────────────────────────
async function fetchData() {
  const now   = new Date();
  const in15  = new Date(now.getTime() + 15 * 864e5);

  const [itemsSnap, batchesSnap, ledgerSnap] = await Promise.all([
    db.collection("items").get(),
    db.collection("batches").get(),
    db.collection("ledger").get(),
  ]);

  const itemMap   = {};
  const ledgerMap = {};
  itemsSnap.forEach( d => { itemMap[d.id]   = { id:d.id, ...d.data() }; });
  ledgerSnap.forEach(d => { ledgerMap[d.id] = { id:d.id, ...d.data() }; });

  const allBatches = [];
  batchesSnap.forEach((d) => {
    allBatches.push({ id:d.id, ...d.data(), expiryDate: d.data().expiryDate?.toDate?.() ?? null });
  });

  const stockMap = {};
  allBatches.forEach(b => { stockMap[b.itemId] = (stockMap[b.itemId] || 0) + (b.quantity || 0); });

  const expiredBatches  = allBatches.filter(b => b.expiryDate && b.expiryDate < now  && b.quantity > 0 && !itemMap[b.itemId]?.alertExempt);
  const expiringBatches = allBatches.filter(b => b.expiryDate && b.expiryDate >= now && b.expiryDate <= in15 && b.quantity > 0 && !itemMap[b.itemId]?.alertExempt);
  const lowStockItems   = Object.values(itemMap).filter(
    item => !item.alertExempt && item.minStockLevel != null && (stockMap[item.id] ?? 0) <= Number(item.minStockLevel)
  );

  return { itemMap, ledgerMap, stockMap, expiredBatches, expiringBatches, lowStockItems };
}

// ── Build HTML email ──────────────────────────────────────────
function buildHTML({ itemMap, ledgerMap, stockMap, expiredBatches, expiringBatches, lowStockItems }) {
  const today = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
  const total = expiredBatches.length + expiringBatches.length + lowStockItems.length;

  const th = `padding:10px 14px;background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;text-align:left;letter-spacing:.05em;`;
  const td = `padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;`;

  let expiredRows = "", expiringRows = "", lowRows = "";

  expiredBatches.forEach(b => {
    const name     = itemMap[b.itemId]?.name ?? "Unknown";
    const supplier = ledgerMap[b.supplierId]?.name ?? "—";
    expiredRows += `<tr>
      <td style="${td}">${name}</td>
      <td style="${td};font-family:monospace;font-size:12px;color:#0f766e;">${b.batchNo}</td>
      <td style="${td}">${b.quantity} ${itemMap[b.itemId]?.unit ?? ""}</td>
      <td style="${td};color:#ef4444;font-weight:700;">${fmtDate(b.expiryDate)}</td>
      <td style="${td};color:#64748b;">${supplier}</td>
    </tr>`;
  });

  expiringBatches.forEach(b => {
    const name     = itemMap[b.itemId]?.name ?? "Unknown";
    const supplier = ledgerMap[b.supplierId]?.name ?? "—";
    const days     = daysLeft(b.expiryDate);
    expiringRows += `<tr>
      <td style="${td}">${name}</td>
      <td style="${td};font-family:monospace;font-size:12px;color:#0f766e;">${b.batchNo}</td>
      <td style="${td}">${b.quantity} ${itemMap[b.itemId]?.unit ?? ""}</td>
      <td style="${td}">
        <span style="color:#f97316;font-weight:700;">${fmtDate(b.expiryDate)}</span>
        <span style="background:#fff7ed;color:#c2410c;font-size:11px;padding:2px 7px;border-radius:4px;margin-left:6px;">${days}d left</span>
      </td>
      <td style="${td};color:#64748b;">${supplier}</td>
    </tr>`;
  });

  lowStockItems.forEach(item => {
    const stock = stockMap[item.id] ?? 0;
    lowRows += `<tr>
      <td style="${td}">${item.name}</td>
      <td style="${td}">${item.category}</td>
      <td style="${td};color:#ef4444;font-weight:700;">${stock} ${item.unit}</td>
      <td style="${td};color:#64748b;">${item.minStockLevel} ${item.unit}</td>
    </tr>`;
  });

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:640px;margin:32px auto 48px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:32px 36px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <span style="font-size:36px;">📦</span>
      <div>
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-.3px;">InvenPro Alert</h1>
        <p style="margin:5px 0 0;color:rgba(255,255,255,.7);font-size:13px;">${today}</p>
      </div>
    </div>
    <div style="margin-top:20px;background:rgba(0,0,0,.15);border-radius:12px;padding:14px 20px;display:inline-block;">
      <span style="color:#fff;font-size:28px;font-weight:800;">${total}</span>
      <span style="color:rgba(255,255,255,.8);font-size:14px;margin-left:8px;">alert${total!==1?"s":""} need your attention</span>
    </div>
  </div>

  <div style="padding:28px 36px;">

  ${expiredBatches.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:18px;">🔴</span>
        <span style="font-weight:800;color:#dc2626;font-size:15px;">EXPIRED STOCK — ${expiredBatches.length} batch${expiredBatches.length>1?"es":""}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #f1f5f9;">
        <thead><tr>
          <th style="${th}">Item</th><th style="${th}">Batch</th>
          <th style="${th}">Qty</th><th style="${th}">Expired On</th><th style="${th}">Supplier</th>
        </tr></thead>
        <tbody>${expiredRows}</tbody>
      </table>
    </div>` : ""}

  ${expiringBatches.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:18px;">🟠</span>
        <span style="font-weight:800;color:#ea580c;font-size:15px;">EXPIRING SOON — ${expiringBatches.length} batch${expiringBatches.length>1?"es":""}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #f1f5f9;">
        <thead><tr>
          <th style="${th}">Item</th><th style="${th}">Batch</th>
          <th style="${th}">Qty</th><th style="${th}">Expiry Date</th><th style="${th}">Supplier</th>
        </tr></thead>
        <tbody>${expiringRows}</tbody>
      </table>
    </div>` : ""}

  ${lowStockItems.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:18px;">🟡</span>
        <span style="font-weight:800;color:#b45309;font-size:15px;">LOW STOCK — ${lowStockItems.length} item${lowStockItems.length>1?"s":""}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #f1f5f9;">
        <thead><tr>
          <th style="${th}">Item</th><th style="${th}">Category</th>
          <th style="${th}">Current Stock</th><th style="${th}">Minimum Level</th>
        </tr></thead>
        <tbody>${lowRows}</tbody>
      </table>
    </div>` : ""}

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:16px 36px;border-top:1px solid #f1f5f9;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">Sent automatically by InvenPro · Daily 9:00 AM IST · Please take action promptly</p>
  </div>
</div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Fetching inventory data from Firestore…");
  const data  = await fetchData();
  const total = data.expiredBatches.length + data.expiringBatches.length + data.lowStockItems.length;

  if (total === 0) {
    console.log("✅ No alerts today — all items are fine. No email sent.");
    process.exit(0);
  }

  console.log(`⚠️  Found ${total} alert(s). Sending emails to ${RECIPIENTS.length} recipient(s)…`);

  const html    = buildHTML(data);
  const today   = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  const subject = `⚠️ InvenPro — ${total} inventory alert${total>1?"s":""} · ${today}`;

  const results = await Promise.allSettled(
    RECIPIENTS.map(({ name, email }) =>
      transporter.sendMail({
        from:    `"InvenPro Alerts" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject,
        html,
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`✅ Sent to ${RECIPIENTS[i].name} <${RECIPIENTS[i].email}>`);
    else console.error(`❌ Failed for ${RECIPIENTS[i].email}:`, r.reason?.message);
  });

  const failed = results.filter(r => r.status === "rejected").length;
  process.exit(failed === RECIPIENTS.length ? 1 : 0);
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
