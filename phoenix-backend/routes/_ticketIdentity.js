// routes/_ticketIdentity.js
function cleanString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * public ticket identity:
 * فقط از headerهای هویتی خوانده می‌شود.
 * body/query دیگر منبع معتبر هویت نیستند.
 *
 * هدرهای مجاز:
 * - x-user-id
 * - x-opened-by-id
 * - x-user-phone
 * - x-contact
 */
export function extractTicketIdentity(req) {
  const headers = req?.headers || {};

  const openedById =
    cleanString(headers["x-user-id"]) ||
    cleanString(headers["x-opened-by-id"]);

  const contact =
    cleanString(headers["x-user-phone"]) ||
    cleanString(headers["x-contact"]);

  return {
    openedById,
    contact,
  };
}

export function requireTicketIdentity(req) {
  const identity = extractTicketIdentity(req);

  if (!identity.openedById && !identity.contact) {
    const err = new Error("Ticket identity is required");
    err.statusCode = 400;
    err.publicCode = "TICKET_MISSING_IDENTITY";
    throw err;
  }

  return identity;
}

export function ticketMatchesIdentity(ticket, identity) {
  if (!ticket || !identity) return false;

  if (identity.openedById && ticket.openedById === identity.openedById) {
    return true;
  }

  if (identity.contact && ticket.contact === identity.contact) {
    return true;
  }

  return false;
}
