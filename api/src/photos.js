const { v2: cloudinary } = require('cloudinary');

// Photos are uploaded as "authenticated" assets, so they can only be fetched through signed URLs the API hands out.
// Without Cloudinary credentials, reports are still accepted but their photos are dropped.
function createCloudinaryStore(env = process.env) {
  if (!env.CLOUDINARY_URL && !(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) return null;
  if (!env.CLOUDINARY_URL) {
    cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  }
  return {
    async upload(jpeg, id) {
      const res = await cloudinary.uploader.upload(`data:image/jpeg;base64,${jpeg.toString('base64')}`, {
        public_id: id, folder: 'tapcheck', type: 'authenticated', resource_type: 'image', overwrite: false,
      });
      return res.public_id;
    },
    url: (publicId) => cloudinary.url(publicId, { type: 'authenticated', sign_url: true, secure: true, format: 'jpg' }),
  };
}

module.exports = { createCloudinaryStore };
