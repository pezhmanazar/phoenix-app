import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function createTicket({ title, description, contact }) {
  return prisma.ticket.create({
    data: { title, description, contact: contact || null },
  });
}

export async function listTickets({ contact } = {}) {
  const where = contact ? { contact } : {};
  return prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" }, // ← روی Ticket مجازه
    select: {
      id: true,
      title: true,
      status: true,
      contact: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
}

export async function getTicket(id) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { ts: "asc" } }, // ← مهم: ts نه createdAt
    },
  });
}

export async function addMessage(ticketId, { sender, text }) {
  const exists = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!exists) return null;

  await prisma.message.create({
    data: { ticketId, sender, text }, // ts خودکار
  });

  return {
    ticket: await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { ts: "asc" } } }, // ← باز هم ts
    }),
  };
}

export async function setStatus(id, status) {
  return prisma.ticket.update({ where: { id }, data: { status } });
}