import html2canvas from "html2canvas";

const COLOR_PROPS = [
  "backgroundColor", "color",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor",
] as const;

function fixColorLevel4(val: string): string {
  return val.replace(
    /color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/g,
    (_, r, g, b, a) => {
      const R = Math.round(parseFloat(r) * 255);
      const G = Math.round(parseFloat(g) * 255);
      const B = Math.round(parseFloat(b) * 255);
      const A = a !== undefined ? parseFloat(a) : 1;
      return A < 1 ? `rgba(${R},${G},${B},${A.toFixed(3)})` : `rgb(${R},${G},${B})`;
    }
  );
}

export function patchColorMixOnClone(originalRoot: HTMLElement, clonedRoot: HTMLElement) {
  const orig = [originalRoot, ...Array.from(originalRoot.querySelectorAll<HTMLElement>("*"))];
  const cloned = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>("*"))];
  orig.forEach((el, i) => {
    const cl = cloned[i];
    if (!cl) return;
    const cs = window.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = cs[prop as keyof CSSStyleDeclaration] as string;
      if (val && val.includes("color(")) {
        (cl.style as unknown as Record<string, string>)[prop] = fixColorLevel4(val);
      }
    }
  });
}

export function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  }, 100);
}

export async function captureElementToPng(el: HTMLElement, panelTitle?: string): Promise<string> {
  const pad = 24;
  const titleExtraHeight = panelTitle ? 34 : 0;

  await document.fonts?.ready;

  const rect = el.getBoundingClientRect();

  const baseWidth = Math.ceil(Math.max(
    el.scrollWidth,
    el.offsetWidth,
    rect.width,
  ));

  const baseHeight = Math.ceil(Math.max(
    el.scrollHeight,
    el.offsetHeight,
    rect.height,
  ));

  const exportWidth = baseWidth + pad * 2;
  const exportHeight = baseHeight + pad * 2 + titleExtraHeight;

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 3,
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    width: exportWidth,
    height: exportHeight,
    windowWidth: exportWidth,
    windowHeight: exportHeight,
    onclone: (_, cloned) => {
      patchColorMixOnClone(el, cloned);

      cloned.style.boxSizing = "content-box";
      cloned.style.width = `${baseWidth}px`;
      cloned.style.minHeight = `${baseHeight}px`;
      cloned.style.height = "auto";
      cloned.style.padding = `${pad}px`;
      cloned.style.margin = "0";
      cloned.style.background = "#ffffff";
      cloned.style.borderRadius = "8px";
      cloned.style.overflow = "visible";

      cloned.querySelectorAll<HTMLElement>("svg, .recharts-wrapper, .recharts-surface").forEach((node) => {
        node.style.overflow = "visible";
      });

      if (panelTitle) {
        const eyebrow = document.createElement("p");
        eyebrow.textContent = panelTitle;
        eyebrow.style.cssText = "margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;";
        cloned.insertBefore(eyebrow, cloned.firstChild);
      }
    },
  });

  return canvas.toDataURL("image/png");
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Minimal ZIP (Store method — PNGs are already compressed) ────────────────

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (~crc) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const arr of arrays) { out.set(arr, pos); pos += arr.length; }
  return out;
}

export function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const cds: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0),
      name, file.data,
    );
    locals.push(local);

    cds.push(concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), name,
    ));
    offset += local.length;
  }

  const cdData = concat(...cds);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdData.length), u32(offset),
    u16(0),
  );

  return concat(...locals, cdData, eocd);
}

export function tableToCSV(table: HTMLTableElement): string {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => {
          const text = (cell.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim();

          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}