
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

admin.initializeApp();

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const db = admin.database();
const ROOT = "wms_data";

const QUEUE_PATH = `${ROOT}/dispatch_email_queue`;
const CONFIG_PATH = `${ROOT}/email_config`;
const HISTORY_PATH = `${ROOT}/dispatch_email_history`;

function parseAddresses(value) {
  if (Array.isArray(value)) return value.flatMap(parseAddresses);
  if (typeof value !== "string") return [];
  return value
    .split(/[;,\n\r]+/)
    .map(address => address.trim())
    .filter(Boolean);
}

function makeSheetName(name, used) {
  const base = String(name || "Packed Serials")
    .replace(/[\\/?*[\]:]/g, "")
    .substring(0, 25)
    .trim() || "Packed Serials";

  let candidate = base;
  let counter = 1;

  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${counter++}`;
    candidate = base.substring(0, 31 - suffix.length) + suffix;
  }

  used.add(candidate.toLowerCase());
  return candidate;
}

async function makeOutboundWorkbook(log) {
  const workbook = new ExcelJS.Workbook();
  const items = Array.isArray(log.items) ? log.items : [];
  const serials = Array.isArray(log.serials) ? log.serials : [];

  let invoice = String(log.invoiceNo || "").trim();
  const match = invoice.match(/\/([^/]+)$/);
  if (match) invoice = match[1].trim();

  const date = new Date(Number(log.id) || Date.now());
  const dateText = date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata"
  }).replace(/\//g, "-");

  const timeText = date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false
  });

  let header = `${log.shopName || "Outbound"} - ${invoice} - ${dateText} ${timeText}`;

  if (log.pincode) {
    header += ` - PIN: ${log.pincode} (${log.odaStatus || "Normal"})`;
  }

  const usedNames = new Set();

  for (const item of items) {
    const itemName = String(item.name || "Packed Serials");
    const matchingSerials = serials.filter(
      serial => serial && serial.itemName === item.name
    );

    const sheet = workbook.addWorksheet(makeSheetName(itemName, usedNames));

    sheet.addRow([header]);
    sheet.addRow([]);
    sheet.addRow(["S.No.", "Box Number", "Serial Number", "Product Name"]);

    if (matchingSerials.length) {
      matchingSerials.forEach((serial, index) => {
        const value = String(serial.serial || "");
        const displaySerial =
          value.startsWith("Without Serial Number") ||
          value.startsWith("WOS-OUT-") ||
          value.includes("WOS-")
            ? "Without Serial Number"
            : value;

        sheet.addRow([
          index + 1,
          serial.boxNo !== undefined ? `Box ${serial.boxNo}` : "N/A",
          displaySerial,
          serial.itemName || itemName
        ]);
      });
    } else {
      sheet.addRow([1, "N/A", "No serial numbers packed", itemName]);
    }

    sheet.getRow(3).font = { bold: true };
    sheet.columns = [
      { width: 10 },
      { width: 18 },
      { width: 34 },
      { width: 38 }
    ];
  }

  if (!workbook.worksheets.length) {
    const sheet = workbook.addWorksheet("Outbound");
    sheet.addRow([header]);
    sheet.addRow([]);
    sheet.addRow(["S.No.", "Box Number", "Serial Number", "Product Name"]);
    sheet.addRow([1, "N/A", "No item details available", ""]);
  }

  return workbook.xlsx.writeBuffer();
}

exports.sendDueDispatchEmails = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    retryCount: 0,
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD]
  },
  async () => {
    const now = Date.now();
    const queueSnapshot = await db.ref(QUEUE_PATH).get();

    if (!queueSnapshot.exists()) return;

    const queue = queueSnapshot.val() || {};

    for (const [queueKey, job] of Object.entries(queue)) {
      if (
        !job ||
        job.status !== "pending" ||
        Number(job.dueAt) > now
      ) {
        continue;
      }

      // Claim each job transactionally to reduce duplicate sending.
      const claim = await db.ref(`${QUEUE_PATH}/${queueKey}`).transaction(current => {
        if (
          !current ||
          current.status !== "pending" ||
          Number(current.dueAt) > Date.now()
        ) {
          return;
        }

        current.status = "processing";
        current.processingAt = Date.now();
        current.attempts = Number(current.attempts || 0) + 1;

        return current;
      });

      if (!claim.committed || !claim.snapshot.exists()) continue;

      const claimedJob = claim.snapshot.val();

      try {
        const configSnapshot = await db.ref(CONFIG_PATH).get();
        const config = configSnapshot.val() || {};

        const enabled =
          config.enabled !== false &&
          config.autoEmailEnabled !== false;

        const to = parseAddresses(
          config.to || config.toEmails || config.recipientsTo
        );

        const cc = parseAddresses(
          config.cc || config.ccEmails || config.recipientsCc
        );

        if (!enabled) {
          throw new Error("Automatic email is disabled.");
        }

        if (!to.length) {
          throw new Error("No fixed To recipients are configured.");
        }

        const log = claimedJob.dispatch || claimedJob.log || {};
        const buffer = await makeOutboundWorkbook(log);

        const safeShop = String(log.shopName || "Outbound")
          .replace(/[^a-z0-9]/gi, "_");

        const safeInvoice = String(log.invoiceNo || "Dispatch")
          .replace(/[^a-z0-9]/gi, "_");

        const filename = `${safeShop}_${safeInvoice}_OUTBOUND.xlsx`
          .toUpperCase();

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: GMAIL_USER.value(),
            pass: GMAIL_APP_PASSWORD.value()
          }
        });

        const subject =
          `Outbound Dispatch: ${log.shopName || "Vendor"} - ` +
          `${log.invoiceNo || log.id || queueKey}`;

        const body = [
          "WMS Outbound Dispatch Details",
          "",
          `Shop / Vendor: ${log.shopName || "-"}`,
          `Invoice / SO No.: ${log.invoiceNo || "-"}`,
          `PIN Code: ${log.pincode || "-"}`,
          `Address: ${log.address || "-"}`,
          `ODA Status: ${log.odaStatus || "Normal"}`,
          `Courier Recommendation: ${log.courierRecommendation || "-"}`,
          `Dispatch ID: ${log.id || queueKey}`,
          "",
          "The outbound Excel report is attached."
        ].join("\n");

        await transporter.sendMail({
          from: GMAIL_USER.value(),
          to,
          ...(cc.length ? { cc } : {}),
          subject,
          text: body,
          attachments: [{
            filename,
            content: Buffer.from(buffer),
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }]
        });

        await db.ref(`${QUEUE_PATH}/${queueKey}`).update({
          status: "sent",
          sentAt: Date.now(),
          lastError: null
        });

        await db.ref(HISTORY_PATH).push({
          queueKey,
          dispatchId: log.id || queueKey,
          status: "sent",
          sentAt: Date.now(),
          to,
          cc,
          filename
        });

        logger.info("Dispatch email sent", { queueKey });
      } catch (error) {
        const attempts = Number(claimedJob.attempts || 1);
        const failed = attempts >= 5;
        const message = String(error?.message || error).slice(0, 500);

        await db.ref(`${QUEUE_PATH}/${queueKey}`).update({
          status: failed ? "failed" : "pending",
          dueAt: failed
            ? claimedJob.dueAt
            : Date.now() + attempts * 5 * 60 * 1000,
          lastError: message,
          lastAttemptAt: Date.now()
        });

        await db.ref(HISTORY_PATH).push({
          queueKey,
          dispatchId: (claimedJob.dispatch || claimedJob.log || {}).id || queueKey,
          status: failed ? "failed" : "retry_scheduled",
          attemptedAt: Date.now(),
          error: message,
          attempts
        });

        logger.error("Dispatch email attempt failed", {
          queueKey,
          attempts,
          error: message
        });
      }
    }
  }
);
    
