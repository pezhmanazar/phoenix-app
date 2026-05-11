// routes/_ticketIdentity.js

function cleanString(value) {
  if (value === undefined || value === null) return null;

  const s = String(value).trim();

  if (!s) return null;
  if (s.length > 100) return null;

  return s;
}

export function extractTicketIdentity(req) {
  const body = req.body || {};
  const query = req.query || {};
  const headers = req.headers || {};

  const openedById =
    cleanString(body.openedById) ||
    cleanString(query.openedById) ||
    cleanString(headers["x-opened-by-id"]) ||
    cleanString(headers["x-user-id"]);

  const contact =
    cleanString(body.contact) ||
    cleanString(query.contact) ||
    cleanString(headers["x-contact"]);

  return {
    openedById,
    contact,
  };
}

export function requireTicketIdentity(req) {
  const identity = extractTicketIdentity(req);

  if (!identity.openedById && !identity.contact) {
    const err = new Error("missing_identity");
    err.statusCode = 400;
    err.publicCode = "TICKET_MISSING_IDENTITY";
    throw err;
  }

  return identity;
}

export function ticketMatchesIdentity(ticket, identity) {
  if (!ticket || !identity) return false;

  const ticketOpenedById = cleanString(ticket.openedById);
  const ticketContact = cleanString(ticket.contact);

  const reqOpenedById = cleanString(identity.openedById);
  const reqContact = cleanString(identity.contact);

  if (ticketOpenedById && reqOpenedById && ticketOpenedById === reqOpenedById) {
    return true;
  }

  if (ticketContact && reqContact && ticketContact === reqContact) {
    return true;
  }

  return false;
}
