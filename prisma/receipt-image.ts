// Draws a receipt as a PNG, so the example data has real receipt images to show
// in the loan report and the PDF rather than blank placeholders.
//
// Everything here is written by hand — a 5×7 bitmap font and a small PNG writer
// — so seeding needs no image library. Used only by prisma/seed.ts.

import { deflateSync } from 'node:zlib'

const GLYPH_W = 5
const GLYPH_H = 7

// Each glyph is seven rows of five pixels, most significant bit on the left.
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b01100, 0b01000],
  '-': [0, 0, 0, 0b11111, 0, 0, 0],
  ':': [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '*': [0, 0b01010, 0b00100, 0b11111, 0b00100, 0b01010, 0],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
}

type Canvas = { width: number; height: number; pixels: Uint8Array }

function canvas(width: number, height: number, fill: number): Canvas {
  const pixels = new Uint8Array(width * height)
  pixels.fill(fill)
  return { width, height, pixels }
}

function drawGlyph(c: Canvas, char: string, x: number, y: number, scale: number, ink: number) {
  const glyph = FONT[char.toUpperCase()] ?? FONT[' ']
  for (let row = 0; row < GLYPH_H; row++) {
    for (let col = 0; col < GLYPH_W; col++) {
      if (!(glyph[row] & (1 << (GLYPH_W - 1 - col)))) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = x + col * scale + dx
          const py = y + row * scale + dy
          if (px >= 0 && px < c.width && py >= 0 && py < c.height) {
            c.pixels[py * c.width + px] = ink
          }
        }
      }
    }
  }
}

function drawText(c: Canvas, text: string, x: number, y: number, scale: number, ink: number) {
  let cursor = x
  for (const char of text) {
    drawGlyph(c, char, cursor, y, scale, ink)
    cursor += (GLYPH_W + 1) * scale
  }
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, body: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(body)])))
  return Buffer.concat([length, typeBytes, Buffer.from(body), crc])
}

/** Encodes the canvas as an 8-bit greyscale PNG. */
function toPng(c: Canvas): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(c.width, 0)
  header.writeUInt32BE(c.height, 4)
  header[8] = 8 // bit depth
  header[9] = 0 // greyscale
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // Each scanline is preceded by a filter byte; 0 means "no filter".
  const raw = Buffer.alloc((c.width + 1) * c.height)
  for (let y = 0; y < c.height; y++) {
    raw[y * (c.width + 1)] = 0
    Buffer.from(c.pixels.subarray(y * c.width, (y + 1) * c.width)).copy(
      raw,
      y * (c.width + 1) + 1,
    )
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ])
}

export type ReceiptLine = { label: string; amount?: string }

export type ReceiptSpec = {
  shop: string
  place: string
  phone?: string
  date: string
  number: string
  lines: ReceiptLine[]
  total: string
  paidBy: string
}

const COLUMNS = 32
const SCALE = 2
const CHAR_W = (GLYPH_W + 1) * SCALE
const LINE_H = (GLYPH_H + 3) * SCALE
const MARGIN = 14
const PAPER = 0xf4
const INK = 0x22
const FAINT = 0x8a

function centre(text: string): string {
  const pad = Math.max(0, Math.floor((COLUMNS - text.length) / 2))
  return ' '.repeat(pad) + text
}

/** "FLOUR 50KG" + "200.00" spread to the full width of the paper. */
function spread(left: string, right: string): string {
  const room = COLUMNS - right.length
  const clipped = left.length > room - 1 ? left.slice(0, room - 1) : left
  return clipped + ' '.repeat(Math.max(1, room - clipped.length)) + right
}

/** Renders a shop receipt as PNG bytes, ready to store in the database. */
export function receiptPng(spec: ReceiptSpec): Uint8Array<ArrayBuffer> {
  const rule = '-'.repeat(COLUMNS)
  const body: Array<{ text: string; ink: number }> = [
    { text: centre(spec.shop.toUpperCase()), ink: INK },
    { text: centre(spec.place.toUpperCase()), ink: FAINT },
    ...(spec.phone ? [{ text: centre(`TEL ${spec.phone}`), ink: FAINT }] : []),
    { text: rule, ink: FAINT },
    { text: spread(`DATE ${spec.date}`, `#${spec.number}`), ink: INK },
    { text: rule, ink: FAINT },
    ...spec.lines.map((line) => ({
      text: line.amount ? spread(line.label.toUpperCase(), line.amount) : line.label.toUpperCase(),
      ink: INK,
    })),
    { text: rule, ink: FAINT },
    { text: spread('TOTAL LYD', spec.total), ink: INK },
    { text: `PAID BY ${spec.paidBy.toUpperCase()}`, ink: FAINT },
    { text: rule, ink: FAINT },
    { text: centre('THANK YOU'), ink: FAINT },
  ]

  const width = COLUMNS * CHAR_W + MARGIN * 2
  const height = body.length * LINE_H + MARGIN * 2 + LINE_H
  const c = canvas(width, height, PAPER)

  // A soft edge, so it reads as a photographed slip rather than a plain box.
  for (let x = 0; x < width; x++) {
    c.pixels[x] = 0xdc
    c.pixels[(height - 1) * width + x] = 0xdc
  }
  for (let y = 0; y < height; y++) {
    c.pixels[y * width] = 0xdc
    c.pixels[y * width + width - 1] = 0xdc
  }

  body.forEach((line, index) => {
    drawText(c, line.text, MARGIN, MARGIN + index * LINE_H, SCALE, line.ink)
  })

  // Copied into a plain ArrayBuffer rather than wrapping Node's Buffer, which
  // is what the database column expects.
  const png = toPng(c)
  const bytes = new Uint8Array(png.byteLength)
  bytes.set(png)
  return bytes
}
