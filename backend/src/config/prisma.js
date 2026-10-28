import { PrismaClient } from '@prisma/client';

// Singleton — reutiliza a mesma instância em todo o app
const prisma = new PrismaClient();

export default prisma;
