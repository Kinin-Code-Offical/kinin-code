const MAX_MESSAGE_LENGTH = 2000;

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

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ ok: false, error: "message_too_long" }, { status: 400 });
  }

  console.info("[contact]", {
    name,
    email,
    message,
    receivedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
