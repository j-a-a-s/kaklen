export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  creator: string;
  createdAt: Date;
}

export interface PdfTextCommand {
  kind: "text";
  x: number;
  y: number;
  text: string;
  size: number;
  bold?: boolean;
}

export interface PdfLineCommand {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  gray?: number;
}

export interface PdfRectCommand {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  gray: number;
}

export interface PdfImageCommand {
  kind: "image";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfImageResource {
  name: string;
  width: number;
  height: number;
  data: Buffer;
}

export interface PdfDocumentResources {
  images?: readonly PdfImageResource[];
}

export type PdfCommand = PdfTextCommand | PdfLineCommand | PdfRectCommand | PdfImageCommand;

export function createPdfDocument(
  pages: PdfCommand[][],
  metadata: PdfMetadata,
  resources: PdfDocumentResources = {}
): Buffer {
  const pageCount = Math.max(1, pages.length);
  const images = resources.images ?? [];
  const firstImageObject = 5;
  const firstPageObject = firstImageObject + images.length;
  const pageReferences = Array.from({ length: pageCount }, (_, index) => firstPageObject + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageReferences.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  images.forEach((image, index) => {
    const imageObject = firstImageObject + index;
    const stream = image.data.toString("latin1");
    objects.set(
      imageObject,
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.data.length} >>\nstream\n${stream}\nendstream`
    );
  });
  const imageResources = images.length
    ? ` /XObject << ${images.map((image, index) => `/${pdfName(image.name)} ${firstImageObject + index} 0 R`).join(" ")} >>`
    : "";

  pages.forEach((commands, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    const stream = commands.map(renderCommand).join("\n");
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${imageResources} >> /Contents ${contentObject} 0 R >>`
    );
    objects.set(contentObject, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

  const infoObject = firstPageObject + pageCount * 2;
  objects.set(
    infoObject,
    `<< /Title (${pdfString(metadata.title)}) /Author (${pdfString(metadata.author)}) /Subject (${pdfString(metadata.subject)}) /Creator (${pdfString(metadata.creator)}) /CreationDate (D:${pdfDate(metadata.createdAt)}) >>`
  );

  const maxObject = infoObject;
  const chunks: string[] = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets = new Array<number>(maxObject + 1).fill(0);
  let offset = Buffer.byteLength(chunks[0], "latin1");
  for (let id = 1; id <= maxObject; id += 1) {
    const object = `${id} 0 obj\n${objects.get(id) ?? "<< >>"}\nendobj\n`;
    offsets[id] = offset;
    chunks.push(object);
    offset += Buffer.byteLength(object, "latin1");
  }
  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${maxObject + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `)
  ].join("\n");
  chunks.push(`${xref}\ntrailer\n<< /Size ${maxObject + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "latin1");
}

function renderCommand(command: PdfCommand): string {
  if (command.kind === "text") {
    return `BT /${command.bold ? "F2" : "F1"} ${number(command.size)} Tf 1 0 0 1 ${number(command.x)} ${number(command.y)} Tm (${pdfString(command.text)}) Tj ET`;
  }
  if (command.kind === "line") {
    const gray = command.gray ?? 0.75;
    return `q ${number(gray)} G ${number(command.width ?? 0.5)} w ${number(command.x1)} ${number(command.y1)} m ${number(command.x2)} ${number(command.y2)} l S Q`;
  }
  if (command.kind === "image") {
    return `q ${number(command.width)} 0 0 ${number(command.height)} ${number(command.x)} ${number(command.y)} cm /${pdfName(command.name)} Do Q`;
  }
  return `q ${number(command.gray)} g ${number(command.x)} ${number(command.y)} ${number(command.width)} ${number(command.height)} re f Q`;
}

export function measurePdfText(value: string, size: number, bold = false): number {
  return [...value.normalize("NFD")].reduce((width, character) =>
    width + glyphWidth(character, bold), 0) * size / 1000;
}

function pdfString(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\xFF]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfDate(value: Date): string {
  const iso = value.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${iso}Z`;
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function pdfName(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_-]/g, "");
  if (!normalized) throw new RangeError("PDF resource name is empty");
  return normalized;
}

const NORMAL_WIDTHS: Readonly<Record<string, number>> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  "[": 278, "\\": 278, "]": 278, "^": 469, "_": 556, "`": 333, "{": 334, "|": 260, "}": 334, "~": 584
};

const BOLD_WIDTHS: Readonly<Record<string, number>> = {
  ...NORMAL_WIDTHS,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556,
  K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278,
  k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333,
  u: 611, v: 556, w: 778, x: 556, y: 556, z: 500
};

function glyphWidth(character: string, bold: boolean): number {
  if (/\p{M}/u.test(character)) return 0;
  if (/\d/.test(character)) return 556;
  return (bold ? BOLD_WIDTHS : NORMAL_WIDTHS)[character] ?? 556;
}
