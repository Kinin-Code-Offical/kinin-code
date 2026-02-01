import { google } from "googleapis";

const MAX_MESSAGE_LENGTH = 2000;
const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

type SheetsConfig =
  | { sheetId: string; range: string }
  | { sheetId: string; range: string; clientEmail: string; privateKey: string };

const getSheetsConfig = (): SheetsConfig | null => {
  const sheetId = process.env.GOOGLE_SHEETS_SHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const range = process.env.GOOGLE_SHEETS_RANGE?.trim() || "Contacts!A:D";
  const privateKey = privateKeyRaw?.replace(/\\n/g, "\n");
  if (!sheetId || !clientEmail || !privateKey) {
    return sheetId ? { sheetId, range } : null;
  }
  return { sheetId, clientEmail, privateKey, range };
};

const appendToSheet = async (values: string[]) => {
  const config = getSheetsConfig();
  if (!config) {
    throw new Error("missing_google_sheets_config");
  }
  const auth =
    "clientEmail" in config && "privateKey" in config
      ? new google.auth.JWT({
        email: config.clientEmail,
        key: config.privateKey,
        scopes: SHEETS_SCOPES,
      })
      : new google.auth.GoogleAuth({
        scopes: SHEETS_SCOPES,
      });
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range: config.range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values],
    },
  });
};

const isValidEmail = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const message = String(payload.message ?? "").trim();

  if (!name || !email || !message) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ ok: false, error: "message_too_long" }, { status: 400 });
  }

  const receivedAt = new Date().toISOString();

  try {
    await appendToSheet([receivedAt, name, email, message]);
  } catch (error) {
    console.error("[contact] sheets_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ ok: false, error: "delivery_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, receivedAt });
}

export function GET() {
  return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
