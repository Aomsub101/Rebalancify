/**
 * generate-icons.mjs
 *
 * Generates 192×192 and 512×512 PNG icons for the PWA manifest.
 * Uses only Node.js built-ins (zlib, fs, path) — no external dependencies.
 *
 * Colour: #1E3A5F (Rebalancify navy — matches theme_color in manifest.json)
 *
 * Run: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ICONS_DIR = resolve(ROOT, 'public', 'icons')

// Rebalancify navy #1E3A5F  →  R=30, G=58, B=95
const BG_R = 30
const BG_G = 58
const BG_B = 95

// ──────────────────────────────────────────────────────────────────────────────
// CRC-32 (required by PNG spec for chunk checksums)
// ──────────────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ──────────────────────────────────────────────────────────────────────────────
// PNG chunk builder
// ──────────────────────────────────────────────────────────────────────────────
function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crcBuf])
}

// ──────────────────────────────────────────────────────────────────────────────
// Generate a solid-colour PNG
// ──────────────────────────────────────────────────────────────────────────────
function makeSolidPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR: width, height, bit depth=8, colour type=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 2  // RGB
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdr = chunk('IHDR', ihdrData)

  // Raw image data: each row is [filterByte=0, R, G, B, R, G, B, ...]
  const rowBytes = 1 + size * 3
  const raw = Buffer.alloc(size * rowBytes)
  for (let y = 0; y < size; y++) {
    const offset = y * rowBytes
    raw[offset] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      raw[offset + 1 + x * 3] = r
      raw[offset + 2 + x * 3] = g
      raw[offset + 3 + x * 3] = b
    }
  }

  const compressed = deflateSync(raw, { level: 9 })
  const idat = chunk('IDAT', compressed)

  // IEND
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// ──────────────────────────────────────────────────────────────────────────────
// Write files
// ──────────────────────────────────────────────────────────────────────────────
mkdirSync(ICONS_DIR, { recursive: true })

const icon192 = makeSolidPNG(192, BG_R, BG_G, BG_B)
writeFileSync(resolve(ICONS_DIR, 'icon-192.png'), icon192)
console.log('✓ public/icons/icon-192.png (%d bytes)', icon192.length)

const icon512 = makeSolidPNG(512, BG_R, BG_G, BG_B)
writeFileSync(resolve(ICONS_DIR, 'icon-512.png'), icon512)
console.log('✓ public/icons/icon-512.png (%d bytes)', icon512.length)
