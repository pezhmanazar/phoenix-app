//phoenix-app\phoenix-backend\routes\_ticketIdentity.js
export function cleanString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function extractTicketIdentity(req) {
  const openedById =
    cleanString(req.body?.openedById) ||
    cleanString(req.query?.openedById) ||
    cleanString(req.headers["x-opened-by-id"]);

  const contact =
    cleanString(req.body?.contact) ||
    cleanString(req.query?.contact) ||
    cleanString(req.headers["x-contact"]);

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
    throw err;
  }

  return identity;
}
