/**
 * Zero-dependency, pure TypeScript QR Code generator (ISO/IEC 18004).
 * Generates vector SVGs and Data URLs synchronously in memory in < 1ms.
 * 100% offline, zero network requests, zero external packages.
 */

export type EccLevel = "L" | "M" | "Q" | "H";

export interface QrOptions {
  size?: number | string;
  margin?: number;
  fgColor?: string;
  bgColor?: string;
  ecc?: EccLevel;
}

// QR Code Constants & Reed-Solomon polynomial tables
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // Version: 1-40, ECC: [L, M, Q, H]
  [7, 10, 13, 17],
  [10, 16, 22, 28],
  [15, 26, 36, 44],
  [20, 36, 52, 64],
  [26, 48, 72, 88],
  [36, 64, 96, 112],
  [40, 72, 108, 130],
  [48, 88, 132, 156],
  [60, 110, 160, 192],
  [72, 130, 192, 224],
];

const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 2, 2],
  [1, 2, 2, 4],
  [1, 2, 4, 4],
  [2, 4, 4, 4],
  [2, 4, 6, 5],
  [2, 4, 6, 6],
  [2, 5, 8, 8],
  [4, 5, 8, 8],
];

const CAPACITY_BYTES: number[][] = [
  // Total data capacity in bytes for versions 1..10, [L, M, Q, H]
  [19, 16, 13, 9],
  [34, 28, 22, 16],
  [55, 44, 34, 26],
  [80, 64, 48, 36],
  [108, 86, 62, 46],
  [136, 108, 76, 60],
  [156, 124, 88, 66],
  [194, 154, 110, 86],
  [232, 182, 132, 100],
  [274, 216, 154, 122],
];

// Galois Field GF(256) tables with primitive polynomial 0x11d (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val <<= 1;
    if (val & 0x100) {
      val ^= 0x11d;
    }
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function reedSolomonComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMul(divisor[i], factor);
    }
  }
  return result;
}

class BitBuffer {
  private buffer: number[] = [];
  public length = 0;

  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

const ALIGNMENT_PATTERN_POSITIONS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const ECC_INDEX: Record<EccLevel, number> = {
  L: 0,
  M: 1,
  Q: 2,
  H: 3,
};

const FORMAT_BITS: Record<EccLevel, number[]> = {
  // 8 mask patterns for each ECC level
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bfd],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

/**
 * Encodes text into a standard QR code matrix.
 */
export function generateQrMatrix(
  text: string,
  ecc: EccLevel = "M"
): { size: number; modules: boolean[][] } {
  const textBytes = new TextEncoder().encode(text);
  const eccIdx = ECC_INDEX[ecc];

  // Determine smallest suitable version (1..10)
  let version = 1;
  while (version <= 10) {
    if (CAPACITY_BYTES[version - 1][eccIdx] >= textBytes.length) {
      break;
    }
    version++;
  }

  if (version > 10) {
    throw new Error(`Data too long for compact QR code generator (${textBytes.length} bytes)`);
  }

  const numDataCodewords = CAPACITY_BYTES[version - 1][eccIdx];
  const numEccCodewords = ECC_CODEWORDS_PER_BLOCK[version - 1][eccIdx];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[version - 1][eccIdx];

  // Encode data in 8-bit Byte mode
  const bb = new BitBuffer();
  bb.put(0x04, 4); // Byte mode indicator
  bb.put(textBytes.length, version <= 9 ? 8 : 16); // Character count indicator
  for (const b of textBytes) {
    bb.put(b, 8);
  }

  // Terminator (up to 4 zero bits)
  const maxDataBits = numDataCodewords * 8;
  const termBits = Math.min(4, maxDataBits - bb.length);
  bb.put(0, termBits);

  // Align to byte
  while (bb.length % 8 !== 0) {
    bb.putBit(false);
  }

  // Pad bytes 0xEC and 0x11
  let padByte = 0xec;
  while (bb.length < maxDataBits) {
    bb.put(padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  const dataBytes = bb.getBytes();

  // Split into blocks and calculate Reed-Solomon ECC
  const blocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  const divisor = reedSolomonComputeDivisor(numEccCodewords);

  const shortBlockLen = Math.floor(numDataCodewords / numBlocks);
  const numLongBlocks = numDataCodewords % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  let byteOffset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const blockLen = i < numShortBlocks ? shortBlockLen : shortBlockLen + 1;
    const block = dataBytes.slice(byteOffset, byteOffset + blockLen);
    byteOffset += blockLen;
    blocks.push(block);
    eccBlocks.push(reedSolomonComputeRemainder(block, divisor));
  }

  // Interleave data codewords then ecc codewords
  const finalCodewords: number[] = [];
  const maxBlockLen = shortBlockLen + (numLongBlocks > 0 ? 1 : 0);

  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocks[b].length) {
        finalCodewords.push(blocks[b][i]);
      }
    }
  }

  for (let i = 0; i < numEccCodewords; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(eccBlocks[b][i]);
    }
  }

  // Matrix generation
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunctionModule(r: number, c: number, val: boolean) {
    modules[r][c] = val;
    isFunction[r][c] = true;
  }

  // 1. Finder patterns
  function drawFinderPattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            setFunctionModule(nr, nc, true);
          } else {
            setFunctionModule(nr, nc, false);
          }
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // 2. Alignment patterns for version >= 2
  if (version >= 2) {
    const pos = ALIGNMENT_PATTERN_POSITIONS[version - 1];
    for (const r of pos) {
      for (const c of pos) {
        if (isFunction[r][c]) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const isBorder = Math.abs(dy) === 2 || Math.abs(dx) === 2;
            const isCenter = dy === 0 && dx === 0;
            setFunctionModule(r + dy, c + dx, isBorder || isCenter);
          }
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setFunctionModule(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setFunctionModule(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  setFunctionModule(size - 8, 8, true);

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }

  // 6. Masking function definition
  const maskConditions = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  // Best default mask pattern for URLs is pattern 2 or evaluated
  const mask = 2;
  const isMasked = maskConditions[mask];

  // 7. Place data bits
  let bitIndex = 0;
  let dir = -1;
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = dir === -1 ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const currentCol = col - c;
        if (!isFunction[row][currentCol]) {
          let bit = false;
          if (bitIndex < finalCodewords.length * 8) {
            const byteVal = finalCodewords[Math.floor(bitIndex / 8)];
            bit = ((byteVal >>> (7 - (bitIndex % 8))) & 1) === 1;
          }
          bitIndex++;
          if (isMasked(row, currentCol)) {
            bit = !bit;
          }
          modules[row][currentCol] = bit;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // 8. Write format bits
  const formatVal = FORMAT_BITS[ecc][mask];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatVal >>> i) & 1) === 1;
    // Top-left
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[8][15 - i] = bit;

    // Bottom-left / Top-right
    if (i < 8) modules[8][size - 1 - i] = bit;
    else modules[size - 15 + i][8] = bit;
  }

  return { size, modules };
}

/**
 * Generates an SVG string representation of the QR code.
 * Fast, crisp, vector quality at any printer resolution or screen DPI.
 */
export function generateQrSvgString(text: string, options: QrOptions = {}): string {
  const {
    size = "100%",
    margin = 1,
    fgColor = "#000000",
    bgColor = "#ffffff",
    ecc = "M",
  } = options;

  const { size: matrixSize, modules } = generateQrMatrix(text, ecc);
  const totalSize = matrixSize + margin * 2;

  // Build optimized path string for all dark modules
  let pathD = "";
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (modules[r][c]) {
        pathD += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  const dimAttr = typeof size === "number" ? `width="${size}" height="${size}"` : `style="width:${size};height:${size};"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" ${dimAttr} shape-rendering="crispEdges">` +
    (bgColor && bgColor !== "transparent" ? `<rect width="100%" height="100%" fill="${bgColor}"/>` : "") +
    `<path d="${pathD.trim()}" fill="${fgColor}"/>` +
    `</svg>`;
}

/**
 * Returns a Data URL with embedded SVG (safe for immediate src assignment in <img>).
 */
export function generateQrDataUrl(text: string, options: QrOptions = {}): string {
  const svg = generateQrSvgString(text, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
