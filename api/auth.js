const crypto = require('node:crypto');

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'hex');
  const got = crypto.scryptSync(String(password), salt, want.length);
  return crypto.timingSafeEqual(got, want);
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

if (require.main === module) {
  const pw = process.argv[2];
  if (!pw) {
    console.error('Usage: npm run hash-password -- <password>');
    process.exit(1);
  }
  console.log(hashPassword(pw));
}

module.exports = { hashPassword, verifyPassword, safeEqual };
