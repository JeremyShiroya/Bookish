import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE   = path.resolve(__dirname, '..');
const PUBLIC = path.join(BASE, 'public', 'Images');
const OUT    = path.join(__dirname, 'gallery');
fs.mkdirSync(OUT, { recursive: true });

const W = 1280, H = 460;
const CW = 158, CH = 237;

// ── Card definitions ─────────────────────────────────────────────────────────
const CARDS = [
  {
    file: 'library.png',
    title: 'Your Library,', title2: 'Always Organised.',
    sub1: 'Browse by author, genre, series or collection.',
    sub2: 'Track reading status and ratings at a glance.',
    g1: '#78350F', g2: '#D97706',
    covers: ['Red Rising.jpg', '1984.jpg', 'Brave New World.jpg'],
  },
  {
    file: 'reader.png',
    title: 'Read How', title2: 'You Want To.',
    sub1: 'EPUB and PDF, chapter navigation, zoom,',
    sub2: 'table of contents and independent dark mode.',
    g1: '#1E3A5F', g2: '#3B82F6',
    covers: ['Three Body Problem.jpg', 'The God Delusion.jpg', 'TheWillOfTheMany.jpg'],
  },
  {
    file: 'tts.png',
    title: 'Every Book', title2: 'an Audiobook.',
    sub1: 'Neural voices, real-time word highlighting,',
    sub2: 'speed control, skip and rewind.',
    g1: '#2E1065', g2: '#7C3AED',
    covers: ['Hunger of the gods.jpg', 'The blood kingdom.jpg', 'Red Wolf.jpg'],
  },
  {
    file: 'metadata.png',
    title: 'Covers. Ratings.', title2: 'Blurbs. Done.',
    sub1: 'Add a title and author — Bookish fetches',
    sub2: 'everything else automatically.',
    g1: '#064E3B', g2: '#059669',
    covers: ['The Boyfriend.jpg', 'Into The Water.jpg', 'girlonthetrain.jpg'],
  },
  {
    file: 'authors.png',
    title: 'Know Your', title2: 'Authors.',
    sub1: 'Dedicated profiles with photo, biography',
    sub2: 'and their full catalogue from your library.',
    g1: '#7F1D1D', g2: '#DC2626',
    covers: ['Broken.jpg', 'He Started It.jpg', 'Unforgivable.jpg'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROUND_MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
  <rect width="${CW}" height="${CH}" rx="10" ry="10" fill="white"/>
</svg>`;

async function loadCover(filename, rotateDeg) {
  const fullPath = path.join(PUBLIC, filename);
  if (!fs.existsSync(fullPath)) return null;

  // Resize + rounded corners
  let buf = await sharp(fullPath)
    .resize(CW, CH, { fit: 'cover', position: 'top' })
    .composite([{ input: Buffer.from(ROUND_MASK_SVG), blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Rotate (adds transparent padding)
  if (rotateDeg !== 0) {
    buf = await sharp(buf)
      .rotate(rotateDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }
  return buf;
}

async function makeShadow(coverBuf) {
  const { width: w, height: h } = await sharp(coverBuf).metadata();
  // Black silhouette with same alpha as cover, then blur
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 200 } },
  })
    .composite([{ input: coverBuf, blend: 'dest-in' }])
    .blur(14)
    .png()
    .toBuffer();
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Main builder ──────────────────────────────────────────────────────────────
async function makeCard(card, idx) {
  const uid = `g${idx}`;

  // 1. Gradient background
  const bgSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stop-color="${card.g1}"/>
        <stop offset="100%" stop-color="${card.g2}"/>
      </linearGradient>
      <radialGradient id="${uid}gl" cx="78%" cy="28%" r="48%">
        <stop offset="0%"   stop-color="white" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}bg)"/>
    <rect width="${W}" height="${H}" fill="url(#${uid}gl)"/>
  </svg>`);

  const base = await sharp(bgSvg).resize(W, H).png().toBuffer();

  // 2. Covers – visual centres and tilt angles
  // The three covers fan out on the left half of the card
  const slots = [
    { cx: 148, cy: 210, rot: -9 },
    { cx: 298, cy: 232, rot:  0 },
    { cx: 448, cy: 218, rot:  7 },
  ];

  const composites = [];

  for (let i = 0; i < card.covers.length; i++) {
    const coverBuf = await loadCover(card.covers[i], slots[i].rot);
    if (!coverBuf) continue;

    const { width: rw, height: rh } = await sharp(coverBuf).metadata();
    const left = Math.round(slots[i].cx - rw / 2);
    const top  = Math.round(slots[i].cy - rh / 2);

    // Shadow offset below/right
    const shadow = await makeShadow(coverBuf);
    composites.push({ input: shadow, left: left + 5, top: top + 10 });

    // Cover itself
    composites.push({ input: coverBuf, left, top });
  }

  // 3. Vignette + text overlay (pure SVG — no images, always works)
  const textSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Left vignette: blends covers into bg -->
      <linearGradient id="${uid}vl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"  stop-color="${card.g1}" stop-opacity="0.82"/>
        <stop offset="48%" stop-color="${card.g1}" stop-opacity="0"/>
      </linearGradient>
      <!-- Right vignette: keeps text area deep -->
      <linearGradient id="${uid}vr" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%"  stop-color="${card.g1}" stop-opacity="0.55"/>
        <stop offset="52%" stop-color="${card.g1}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}vl)"/>
    <rect width="${W}" height="${H}" fill="url(#${uid}vr)"/>

    <!-- Title -->
    <text x="${W * 0.515}" y="${H * 0.355}"
          font-family="'Segoe UI','Arial Black',Arial,Helvetica,sans-serif"
          font-size="60" font-weight="800" fill="white" opacity="0.97">${esc(card.title)}</text>
    <text x="${W * 0.515}" y="${H * 0.545}"
          font-family="'Segoe UI','Arial Black',Arial,Helvetica,sans-serif"
          font-size="60" font-weight="800" fill="white" opacity="0.97">${esc(card.title2)}</text>

    <!-- Subtitle -->
    <text x="${W * 0.515}" y="${H * 0.705}"
          font-family="'Segoe UI',Arial,Helvetica,sans-serif"
          font-size="21" font-weight="400"
          fill="rgba(255,255,255,0.72)">${esc(card.sub1)}</text>
    <text x="${W * 0.515}" y="${H * 0.82}"
          font-family="'Segoe UI',Arial,Helvetica,sans-serif"
          font-size="21" font-weight="400"
          fill="rgba(255,255,255,0.72)">${esc(card.sub2)}</text>
  </svg>`);

  composites.push({ input: textSvg, left: 0, top: 0 });

  // 4. Render
  await sharp(base).composite(composites).png().toFile(path.join(OUT, card.file));
  console.log(`  ✓  ${card.file}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Generating gallery cards…\n');
  for (let i = 0; i < CARDS.length; i++) await makeCard(CARDS[i], i);
  console.log('\nDone — saved to docs/gallery/');
})().catch(err => { console.error(err); process.exit(1); });
