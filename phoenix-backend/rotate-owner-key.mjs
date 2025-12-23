import 'dotenv/config';
import crypto from 'crypto';
import prisma from './utils/prisma.js';

const email = 'dr.pezhman.azar@gmail.com';
const newKey = 'own_' + crypto.randomBytes(24).toString('hex');

const admin = await prisma.admin.update({
  where: { email },
  data: { apiKey: newKey },
});

console.log('NEW API KEY:', newKey);
await prisma.$disconnect();
