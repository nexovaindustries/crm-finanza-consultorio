import sharp from 'sharp';

const LOGO = 'public/logo.png';
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon(size, { padding = 0.1, bg = WHITE, out }) {
  const inner = Math.round(size * (1 - padding * 2));
  const trimmed = await sharp(LOGO).trim().toBuffer();
  const mark = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(`public/${out}`);
  console.log('wrote', out);
}

await makeIcon(192, { padding: 0.06, out: 'pwa-192x192.png' });
await makeIcon(512, { padding: 0.06, out: 'pwa-512x512.png' });
await makeIcon(512, { padding: 0.18, out: 'pwa-maskable-512x512.png' });
await makeIcon(180, { padding: 0.08, out: 'apple-touch-icon.png' });
