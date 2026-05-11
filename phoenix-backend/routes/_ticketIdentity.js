// routes/_ticketIdentity.js

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * public ticket identity:
 * فقط از auth context معتبر (req.user) خوانده می‌شود.
 * headers / body / query منبع معتبر هویت نیستند.
 */
export function extractTicketIdentity(req) {
  const user = req?.user || {};

  const openedById = cleanString(user.id);
  const contact = cleanString(user.phone);

  return {
    openedById,
    contact,
  };
}

export function requireTicketIdentity(req) {
  const identity = extractTicketIdentity(req);

  if (!identity.openedById && !identity.contact) {
    const err = new Error("Authenticated ticket identity is required");
    err.statusCode = 401;
    err.publicCode = "UNAUTHORIZED";
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
