//phoenix-app\phoenix-backend\routes\_ticketAccess.js
export async function getPublicOwnedTicketOrThrow(prisma, ticketId, openedById) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: String(ticketId) },
    select: {
      id: true,
      type: true,
      openedById: true,
      openedByName: true,
      contact: true,
    },
  });

  if (!ticket) {
    const err = new Error("not_found");
    err.statusCode = 404;
    throw err;
  }

  if (!openedById || String(ticket.openedById || "") !== String(openedById)) {
    const err = new Error("forbidden");
    err.statusCode = 403;
    throw err;
  }

  return ticket;
}
