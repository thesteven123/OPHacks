const { PrismaClient } = require('@prisma/client');
const { createApp } = require('./app');
const { createCloudinaryStore } = require('./photos');

for (const name of ['DATABASE_URL', 'INTERNAL_API_KEY']) {
  if (!process.env[name]) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
}

const photos = createCloudinaryStore();
if (!photos) console.warn('Cloudinary is not configured: reports are accepted but photos are dropped.');

const port = Number(process.env.PORT || 4000);
createApp({ prisma: new PrismaClient(), photos }).listen(port, () => console.log(`TapCheck API on :${port}`));
