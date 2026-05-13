// phoenix-app/api/tickets.ts
import { BACKEND_URL } from "../constants/backend";

export type TicketMessageType = "text" | "voice" | "image" | "file";

export type TicketMessage = {
  id: string;
  ticketId: string;
  sender: "user" | "admin";
  type?: TicketMessageType;
  text?: string | null;
  fileUrl?: string | null;
  mime?: string | null;
  durationSec?: number | null;
  ts?: string;
  createdAt?: string;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  contact?: string | null;
  status: "open" | "pending" | "closed";
  type: "tech" | "therapy";
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
};

function requireAuthHeaders(token: string, json = false): Record<string, string> {
  if (!token || !token.trim()) {
    throw new Error("توکن احراز هویت موجود نیست.");
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function parseJsonResponse(res: Response) {
  let json: any = null;

  try {
    json = await res.json();
  } catch {
    throw new Error("پاسخ سرور قابل خواندن نیست (JSON نبود).");
  }

  return json;
}

export async function createTicket(params: {
  token: string;
  ticketType: "tech" | "therapy";
  text: string;
}): Promise<{ ticketId: string; ticket: Ticket | null }> {
  const { token, ticketType, text } = params;

  const payload = {
    type: ticketType,
    text: text.trim() ? text.trim() : "ضمیمه",
  };

  const res = await fetch(`${BACKEND_URL}/api/public/tickets/send`, {
    method: "POST",
    headers: requireAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  const json = await parseJsonResponse(res);

  if (!res.ok || !json?.ok) {
    const serverErr = typeof json?.error === "string" ? json.error : undefined;
    throw new Error(
      serverErr && serverErr.trim().length
        ? serverErr
        : "ساخت تیکت ناموفق بود"
    );
  }

  const newId: unknown =
    (json.ticket && json.ticket.id) || json.ticketId || json.id;

  if (!newId || typeof newId !== "string") {
    throw new Error("ساخت تیکت انجام شد اما شناسهٔ تیکت از سرور برنگشت.");
  }

  return {
    ticketId: newId,
    ticket: json.ticket ?? null,
  };
}

export async function sendTicketReply(params: {
  token: string;
  ticketId: string;
  text: string;
}): Promise<Ticket | null> {
  const { token, ticketId, text } = params;

  const res = await fetch(`${BACKEND_URL}/api/public/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: requireAuthHeaders(token, true),
    body: JSON.stringify({
      text: text.trim(),
    }),
  });


  let json: any = null;
  try {
    json = await res.json();
  } catch {}

  if (!res.ok || !json?.ok) {
    const msg =
      typeof json?.error === "string" && json.error.trim()
        ? json.error
        : "ارسال ناموفق";
    throw new Error(msg);
  }

  return json.ticket ?? null;
}

export async function uploadTicketReply(params: {
  token: string;
  ticketId: string;
  formData: FormData;
}): Promise<Ticket | null> {
  const { token, ticketId, formData } = params;

  const res = await fetch(
    `${BACKEND_URL}/api/public/tickets/${ticketId}/reply-upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  let rawText = "";
  try {
    rawText = await res.text();
  } catch {}

  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  console.log("UPLOAD_RESPONSE_STATUS", res.status);
  console.log("UPLOAD_RESPONSE_RAW", rawText);

  if (!res.ok || !json?.ok) {
    const msg =
      typeof json?.error === "string" && json.error.trim()
        ? json.error
        : rawText?.trim() || `Upload failed with status ${res.status}`;

    throw new Error(msg);
  }

  return json.ticket ?? null;
}
