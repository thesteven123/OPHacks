// Usage: npm run create-moderator -- <email> <password>
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Usage: npm run create-moderator -- <email> <password of ${MIN_PASSWORD_LENGTH}+ characters>`);
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const password_hash = await bcrypt.hash(password, BCRYPT_COST);
  const normalized = email.trim().toLowerCase();
  await prisma.moderator.upsert({ where: { email: normalized }, create: { email: normalized, password_hash }, update: { password_hash } });
  console.log(`Moderator ${normalized} saved.`);
  await prisma.$disconnect();
})();
