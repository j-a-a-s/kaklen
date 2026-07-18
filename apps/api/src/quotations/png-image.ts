import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import type { PdfImageResource } from "./pdf";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function loadPngImage(path: string, name: string): PdfImageResource {
  const png = readFileSync(path);
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new RangeError(`Invalid PNG signature: ${path}`);
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const compressed: Buffer[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }
  if (width <= 0 || height <= 0 || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new RangeError(`Unsupported PNG format: ${path}`);
  }
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(compressed));
  if (filtered.length !== (stride + 1) * height) {
    throw new RangeError(`Unexpected PNG data length: ${path}`);
  }
  const decoded = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = filtered[row * (stride + 1)];
    const sourceOffset = row * (stride + 1) + 1;
    const targetOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const raw = filtered[sourceOffset + column];
      const left = column >= bytesPerPixel ? decoded[targetOffset + column - bytesPerPixel] : 0;
      const above = row > 0 ? decoded[targetOffset + column - stride] : 0;
      const aboveLeft = row > 0 && column >= bytesPerPixel
        ? decoded[targetOffset + column - stride - bytesPerPixel]
        : 0;
      decoded[targetOffset + column] = unfilterByte(filter, raw, left, above, aboveLeft);
    }
  }
  const rgb = colorType === 2 ? decoded : flattenAlpha(decoded);
  return { name, width, height, data: deflateSync(rgb, { level: 9 }) };
}

function unfilterByte(filter: number, raw: number, left: number, above: number, aboveLeft: number): number {
  if (filter === 0) return raw;
  if (filter === 1) return (raw + left) & 255;
  if (filter === 2) return (raw + above) & 255;
  if (filter === 3) return (raw + Math.floor((left + above) / 2)) & 255;
  if (filter === 4) return (raw + paeth(left, above, aboveLeft)) & 255;
  throw new RangeError(`Unsupported PNG filter: ${filter}`);
}

function paeth(left: number, above: number, aboveLeft: number): number {
  const prediction = left + above - aboveLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const diagonalDistance = Math.abs(prediction - aboveLeft);
  return leftDistance <= aboveDistance && leftDistance <= diagonalDistance
    ? left
    : aboveDistance <= diagonalDistance ? above : aboveLeft;
}

function flattenAlpha(rgba: Buffer): Buffer {
  const rgb = Buffer.alloc(rgba.length / 4 * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    const alpha = rgba[source + 3];
    rgb[target] = compositeOverWhite(rgba[source], alpha);
    rgb[target + 1] = compositeOverWhite(rgba[source + 1], alpha);
    rgb[target + 2] = compositeOverWhite(rgba[source + 2], alpha);
  }
  return rgb;
}

function compositeOverWhite(color: number, alpha: number): number {
  return Math.floor((color * alpha + 255 * (255 - alpha) + 127) / 255);
}
