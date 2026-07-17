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

export type PdfCommand = PdfTextCommand | PdfLineCommand | PdfRectCommand;

export function createPdfDocument(pages: PdfCommand[][], metadata: PdfMetadata): Buffer {
  const pageCount = Math.max(1, pages.length);
  const firstPageObject = 5;
  const pageReferences = Array.from({ length: pageCount }, (_, index) => firstPageObject + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageReferences.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pages.forEach((commands, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    const stream = commands.map(renderCommand).join("\n");
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
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
  return `q ${number(command.gray)} g ${number(command.x)} ${number(command.y)} ${number(command.width)} ${number(command.height)} re f Q`;
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
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
