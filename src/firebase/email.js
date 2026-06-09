import emailjs from "@emailjs/browser";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  ALERT_EMAILS,
} from "./config";

// ── Build the plain-text alert body ──────────────────────────
export function buildAlertBody({ expiredBatches, expiringBatches, lowStockItems, itemMap, stockMap }) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const lines = [];
  lines.push(`InvenPro Daily Inventory Alert`);
  lines.push(`Date: ${today}`);
  lines.push(`${"─".repeat(40)}`);

  if (expiredBatches.length > 0) {
    lines.push(`\n🔴 EXPIRED STOCK (${expiredBatches.length} batch${expiredBatches.length > 1 ? "es" : ""})`);
    expiredBatches.forEach((b) => {
      const name = itemMap[b.itemId]?.name ?? "Unknown Item";
      const exp  = b.expiryDate?.toLocaleDateString("en-IN") ?? "N/A";
      lines.push(`  • ${name} | Batch: ${b.batchNo} | Qty: ${b.quantity} | Expired: ${exp}`);
    });
  }

  if (expiringBatches.length > 0) {
    lines.push(`\n🟠 EXPIRING IN 15 DAYS (${expiringBatches.length} batch${expiringBatches.length > 1 ? "es" : ""})`);
    expiringBatches.forEach((b) => {
      const name = itemMap[b.itemId]?.name ?? "Unknown Item";
      const exp  = b.expiryDate?.toLocaleDateString("en-IN") ?? "N/A";
      const days = Math.ceil((b.expiryDate - new Date()) / 864e5);
      lines.push(`  • ${name} | Batch: ${b.batchNo} | Qty: ${b.quantity} | Expiry: ${exp} (${days} days left)`);
    });
  }

  if (lowStockItems.length > 0) {
    lines.push(`\n🟡 LOW STOCK (${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""})`);
    lowStockItems.forEach((item) => {
      const stock = stockMap[item.id] ?? 0;
      lines.push(`  • ${item.name} | Current: ${stock} ${item.unit} | Minimum: ${item.minStockLevel} ${item.unit}`);
    });
  }

  lines.push(`\n${"─".repeat(40)}`);
  lines.push(`Total Alerts: ${expiredBatches.length + expiringBatches.length + lowStockItems.length}`);
  lines.push(`\nPlease take action as soon as possible.`);
  lines.push(`— InvenPro Inventory System`);

  return lines.join("\n");
}

// ── Build HTML version of the alert (for email body) ─────────
export function buildAlertHTML({ expiredBatches, expiringBatches, lowStockItems, itemMap, stockMap }) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const total = expiredBatches.length + expiringBatches.length + lowStockItems.length;

  const rowStyle  = `padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;`;
  const thStyle   = `padding:10px 12px;background:#f8fafc;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600;text-align:left;`;

  let expiredRows = "", expiringRows = "", lowRows = "";

  expiredBatches.forEach((b) => {
    const name = itemMap[b.itemId]?.name ?? "Unknown";
    const exp  = b.expiryDate?.toLocaleDateString("en-IN") ?? "N/A";
    expiredRows += `<tr><td style="${rowStyle}">${name}</td><td style="${rowStyle}">${b.batchNo}</td><td style="${rowStyle}">${b.quantity}</td><td style="${rowStyle};color:#ef4444;font-weight:600;">${exp}</td></tr>`;
  });

  expiringBatches.forEach((b) => {
    const name = itemMap[b.itemId]?.name ?? "Unknown";
    const exp  = b.expiryDate?.toLocaleDateString("en-IN") ?? "N/A";
    const days = Math.ceil((b.expiryDate - new Date()) / 864e5);
    expiringRows += `<tr><td style="${rowStyle}">${name}</td><td style="${rowStyle}">${b.batchNo}</td><td style="${rowStyle}">${b.quantity}</td><td style="${rowStyle};color:#f97316;font-weight:600;">${exp} <span style="background:#fff7ed;color:#c2410c;font-size:11px;padding:2px 6px;border-radius:4px;">${days}d</span></td></tr>`;
  });

  lowStockItems.forEach((item) => {
    const stock = stockMap[item.id] ?? 0;
    lowRows += `<tr><td style="${rowStyle}">${item.name}</td><td style="${rowStyle};color:#ef4444;font-weight:600;">${stock} ${item.unit}</td><td style="${rowStyle};color:#64748b;">${item.minStockLevel} ${item.unit}</td></tr>`;
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">📦</span>
        <div>
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">InvenPro Alert</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">${today}</p>
        </div>
      </div>
      <div style="margin-top:16px;background:rgba(255,255,255,.15);border-radius:10px;padding:12px 16px;display:inline-block;">
        <span style="color:#fff;font-size:24px;font-weight:700;">${total}</span>
        <span style="color:rgba(255,255,255,.8);font-size:13px;margin-left:6px;">total alert${total !== 1 ? "s" : ""} need attention</span>
      </div>
    </div>

    <div style="padding:24px 32px;">

      ${expiredBatches.length > 0 ? `
      <!-- Expired -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="background:#fef2f2;color:#ef4444;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid #fecaca;">🔴 EXPIRED STOCK — ${expiredBatches.length} batch${expiredBatches.length > 1 ? "es" : ""}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;">
          <thead><tr><th style="${thStyle}">Item</th><th style="${thStyle}">Batch</th><th style="${thStyle}">Qty</th><th style="${thStyle}">Expired On</th></tr></thead>
          <tbody>${expiredRows}</tbody>
        </table>
      </div>` : ""}

      ${expiringBatches.length > 0 ? `
      <!-- Expiring Soon -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="background:#fff7ed;color:#f97316;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid #fed7aa;">🟠 EXPIRING SOON — ${expiringBatches.length} batch${expiringBatches.length > 1 ? "es" : ""}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;">
          <thead><tr><th style="${thStyle}">Item</th><th style="${thStyle}">Batch</th><th style="${thStyle}">Qty</th><th style="${thStyle}">Expiry Date</th></tr></thead>
          <tbody>${expiringRows}</tbody>
        </table>
      </div>` : ""}

      ${lowStockItems.length > 0 ? `
      <!-- Low Stock -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="background:#fefce8;color:#ca8a04;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid #fde68a;">🟡 LOW STOCK — ${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;">
          <thead><tr><th style="${thStyle}">Item</th><th style="${thStyle}">Current Stock</th><th style="${thStyle}">Minimum Level</th></tr></thead>
          <tbody>${lowRows}</tbody>
        </table>
      </div>` : ""}

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent by InvenPro Inventory System · Please take action promptly</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Send to all recipients ────────────────────────────────────
export async function sendEmailAlerts({ expiredBatches, expiringBatches, lowStockItems, itemMap, stockMap }) {
  const total = expiredBatches.length + expiringBatches.length + lowStockItems.length;
  if (total === 0) return { sent: 0, failed: 0, skipped: true };

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const htmlBody  = buildAlertHTML({ expiredBatches, expiringBatches, lowStockItems, itemMap, stockMap });
  const plainBody = buildAlertBody({ expiredBatches, expiringBatches, lowStockItems, itemMap, stockMap });

  const results = await Promise.allSettled(
    ALERT_EMAILS.map(({ name, email }) =>
      emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_name:    name,
          to_email:   email,
          subject:    `⚠️ InvenPro Alert — ${total} issue${total > 1 ? "s" : ""} · ${today}`,
          html_body:  htmlBody,
          plain_body: plainBody,
          total_alerts: String(total),
          date:       today,
        },
        EMAILJS_PUBLIC_KEY
      )
    )
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`Email alerts: ${sent} sent, ${failed} failed`);
  return { sent, failed, skipped: false };
}
