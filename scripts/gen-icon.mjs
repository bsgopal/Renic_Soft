import sharp from 'sharp';
import fs from 'fs';

const src = 'E:/renic_logo.jpeg';
const outIco = 'E:/Production/Renic_Soft/icon.ico';
const outPng = 'E:/Production/Renic_Soft/frontend/src/assets/logo.png';

// Build a valid ICO wrapping a 256x256 PNG (single entry, PNG-encoded)
const buildIco = (pngBuffer) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 0 => 256
  entry.writeUInt8(0, 1); // height 0 => 256
  entry.writeUInt8(0, 2); // colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(pngBuffer.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)

  return Buffer.concat([header, entry, pngBuffer]);
};

const main = async () => {
  if (!fs.existsSync(src)) {
    console.error('Logo not found at', src);
    process.exit(1);
  }

  const base = sharp(src).resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } });

  // 256x256 PNG for web / login panel
  await base.clone().toFile(outPng);

  const pngBuf = await base.clone().png().toBuffer();
  fs.writeFileSync(outIco, buildIco(pngBuf));
  console.log('Generated icon.ico and logo.png');
};

main().catch((e) => { console.error(e); process.exit(1); });