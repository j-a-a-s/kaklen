export interface PdfLine {
  text: string;
  size?: number;
}

export function createSimplePdf(lines: PdfLine[]): Buffer {
  const content = lines
    .flatMap((line, index) => {
      const size = line.size ?? 10;
      const y = 780 - index * 18;
      return [`/F1 ${size} Tf`, `50 ${y} Td`, `(${escapePdfText(line.text)}) Tj`, `0 0 Td`];
    })
    .join("\n");
  const stream = `BT\n${content}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = objects.map((object) => {
    const current = offset;
    offset += Buffer.byteLength(object);
    return current;
  });
  const body = objects.join("");
  const xrefStart = Buffer.byteLength("%PDF-1.4\n" + body);
  const xrefRows = xref.map((item) => `${String(item).padStart(10, "0")} 00000 n `).join("\n");
  const pdf = `%PDF-1.4\n${body}xref\n0 6\n0000000000 65535 f \n${xrefRows}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
