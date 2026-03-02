// setup.js — run once with: node setup.js
// Generates icons/icon16.png, icons/icon48.png, icons/icon128.png
// Uses only Node.js built-ins, no npm packages required.
const fs   = require('fs')
const zlib = require('zlib')
const path = require('path')

function buildPNG(size) {
  // ── CRC32 ────────────────────────────────────────────────
  const crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    crcTable[n] = c >>> 0
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) c = (crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0
    return (c ^ 0xFFFFFFFF) >>> 0
  }

  // ── Chunk builder ────────────────────────────────────────
  function chunk(type, data) {
    const t   = Buffer.from(type, 'ascii')
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0)
    const crcBuf = Buffer.allocUnsafe(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
    return Buffer.concat([len, t, data, crcBuf])
  }

  // ── Parameters ───────────────────────────────────────────
  const cx = size / 2, cy = size / 2
  const outerR = size * 0.46   // clip circle — transparent outside
  const globeR = size * 0.40   // globe radius (leaves a small gap to the clip edge)
  // Line half-thickness: total line width = 2 * lw
  const lw = Math.max(0.8, size * 0.032)

  // Background gradient: bright sky-blue (centre) → deep navy (edge)
  const cA = [14, 165, 233]   // #0ea5e9  sky-500
  const cB = [15,  40, 100]   // #0f2864  dark navy

  // Approximate pixel distance from point (dx,dy) to the ellipse x²/a²+y²/b²=1
  function ellipseDist(dx, dy, a, b) {
    const f  = (dx * dx) / (a * a) + (dy * dy) / (b * b)
    const gx = 2 * dx / (a * a)
    const gy = 2 * dy / (b * b)
    const g  = Math.sqrt(gx * gx + gy * gy)
    return g > 1e-9 ? Math.abs(f - 1) / g : Infinity
  }

  const raw = []

  for (let y = 0; y < size; y++) {
    raw.push(0)  // PNG filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      const r  = Math.sqrt(dx * dx + dy * dy)

      // ── Anti-aliased clip circle ──────────────────────────
      let alpha = 255
      if (r > outerR + 0.5) {
        raw.push(0, 0, 0, 0); continue
      } else if (r > outerR - 0.5) {
        alpha = Math.round((outerR + 0.5 - r) * 255)
      }

      // ── Radial background gradient ────────────────────────
      const t  = Math.min(r / outerR, 1)
      const bgR = Math.round(cA[0] + t * (cB[0] - cA[0]))
      const bgG = Math.round(cA[1] + t * (cB[1] - cA[1]))
      const bgB = Math.round(cA[2] + t * (cB[2] - cA[2]))

      // ── Globe elements (white lines) ──────────────────────
      let lineAlpha = 0

      // 1. Globe circle outline
      const distToOutline = Math.abs(r - globeR)
      if (distToOutline <= lw) {
        lineAlpha = Math.round((1 - distToOutline / lw) * 255)
      }

      // Interior elements (skip if already fully on the outline)
      if (lineAlpha < 255 && r <= globeR + lw) {

        // 2. Equator — horizontal great circle
        const dEq = Math.abs(dy)
        if (dEq <= lw) {
          lineAlpha = Math.max(lineAlpha, Math.round((1 - dEq / lw) * 255))
        }

        // 3. Latitude lines at ±30° north/south  (sin 30° = 0.5)
        const latY  = globeR * 0.50
        const dLatN = Math.abs(dy - (-latY))   // northern 30°
        const dLatS = Math.abs(dy -   latY)    // southern 30°
        for (const dLat of [dLatN, dLatS]) {
          if (dLat <= lw) {
            // clip to the chord at that latitude
            const chordX = Math.sqrt(Math.max(0, globeR * globeR - latY * latY))
            if (Math.abs(dx) <= chordX + lw) {
              lineAlpha = Math.max(lineAlpha, Math.round((1 - dLat / lw) * 255))
            }
          }
        }

        // 4. Prime meridian — vertical great circle (appears as a straight line)
        const dPM = Math.abs(dx)
        if (dPM <= lw) {
          lineAlpha = Math.max(lineAlpha, Math.round((1 - dPM / lw) * 255))
        }

        // 5. Two longitude ellipses at ±45°  →  semi-axes (sin45°·R, R) ≈ (0.707R, R)
        const a45 = globeR * 0.7071
        const d45 = ellipseDist(dx, dy, a45, globeR)
        if (d45 <= lw) {
          lineAlpha = Math.max(lineAlpha, Math.round((1 - d45 / lw) * 255))
        }
      }

      // ── Composite: blend white line over background ───────
      const wa = lineAlpha / 255
      const pr = Math.round(255 * wa + bgR * (1 - wa))
      const pg = Math.round(255 * wa + bgG * (1 - wa))
      const pb = Math.round(255 * wa + bgB * (1 - wa))

      raw.push(pr, pg, pb, alpha)
    }
  }

  // ── IHDR ─────────────────────────────────────────────────
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const compressed = zlib.deflateSync(Buffer.from(raw))
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

const outDir = path.join(__dirname, 'public', 'icons')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

for (const size of [16, 48, 128]) {
  const buf = buildPNG(size)
  const p   = path.join(outDir, `icon${size}.png`)
  fs.writeFileSync(p, buf)
  console.log(`✓  public/icons/icon${size}.png  (${buf.length} bytes)`)
}
console.log('\nDone! Now run:  npm run build')
console.log('Then reload the extension in chrome://extensions')
