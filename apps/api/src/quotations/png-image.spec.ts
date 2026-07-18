import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { loadPngImage } from "./png-image";

describe("loadPngImage", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "kaklen-png-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("rejects a file without the PNG signature", () => {
    const path = writeFixture(directory, "invalid.png", Buffer.from("not-a-png"));

    expect(() => loadPngImage(path, "Invalid")).toThrow("Invalid PNG signature");
  });

  it("rejects unsupported PNG metadata", () => {
    const path = writeFixture(directory, "unsupported.png", pngFixture({ bitDepth: 16 }));

    expect(() => loadPngImage(path, "Unsupported")).toThrow("Unsupported PNG format");
  });

  it("loads an RGB image that uses the no-filter scanline", () => {
    const path = writeFixture(directory, "rgb.png", pngFixture());

    const image = loadPngImage(path, "RgbLogo");

    expect(image).toMatchObject({ name: "RgbLogo", width: 1, height: 1 });
    expect(inflateSync(image.data)).toEqual(Buffer.from([10, 20, 30]));
  });

  it("rejects a scanline with an unexpected decompressed length", () => {
    const path = writeFixture(directory, "length.png", pngFixture({ filtered: Buffer.from([0, 10, 20]) }));

    expect(() => loadPngImage(path, "Length")).toThrow("Unexpected PNG data length");
  });

  it("rejects an unsupported scanline filter", () => {
    const path = writeFixture(directory, "filter.png", pngFixture({ filtered: Buffer.from([5, 10, 20, 30]) }));

    expect(() => loadPngImage(path, "Filter")).toThrow("Unsupported PNG filter: 5");
  });
});

function writeFixture(directory: string, name: string, data: Buffer): string {
  const path = join(directory, name);
  writeFileSync(path, data);
  return path;
}

function pngFixture(options: { bitDepth?: number; filtered?: Buffer } = {}): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = options.bitDepth ?? 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const filtered = options.filtered ?? Buffer.from([0, 10, 20, 30]);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(filtered)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}
