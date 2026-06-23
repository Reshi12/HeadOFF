// This script generates PNG icons from the SVG icon
// Run with: node scripts/generate-icons.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZES = [16, 48, 128];

// Minimal 1x1 transparent PNG for each size 
// In a real build, you'd use sharp or canvas to render the SVG at each size
// For now, create minimal valid PNG files as placeholders

function createMinimalPNG(size) {
  // Create a minimal valid PNG with IHDR, IDAT, and IEND chunks
  // This creates a solid indigo (#4F46E5) square icon
  
  const width = size;
  const height = size;
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);  // width
  ihdrData.writeUInt32BE(height, 4); // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(2, 9);         // color type (RGB)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // Create image data (uncompressed for simplicity)
  // Each row: filter byte (0) + RGB pixels
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Indigo color #4F46E5
      rawData[pixelOffset] = 0x4F;     // R
      rawData[pixelOffset + 1] = 0x46; // G
      rawData[pixelOffset + 2] = 0xE5; // B
    }
  }
  
  // Compress with zlib (use deflate)
  const compressed = deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  
  // CRC32
  let crc = 0xFFFFFFFF;
  for (const byte of crcData) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  crc ^= 0xFFFFFFFF;
  
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

async function main() {
  const outDir = join(__dirname, '..', 'public', 'icons');
  mkdirSync(outDir, { recursive: true });
  
  for (const size of SIZES) {
    const png = createMinimalPNG(size);
    const outPath = join(outDir, `icon${size}.png`);
    writeFileSync(outPath, png);
    console.log(`Generated ${outPath} (${size}x${size})`);
  }
}

main().catch(console.error);
