const INLINE_PROPS = [
  "fill", "stroke", "stroke-width", "stroke-dasharray",
  "font-family", "font-size", "font-weight", "font-style",
  "opacity", "text-anchor", "dominant-baseline",
];

export async function svgToPng(svgEl: SVGSVGElement, scale = 2): Promise<string> {
  const { width, height } = svgEl.getBoundingClientRect();
  if (!width || !height) return "";

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const srcEls = svgEl.querySelectorAll<SVGElement>("*");
  const dstEls = clone.querySelectorAll<SVGElement>("*");

  srcEls.forEach((el, i) => {
    const cs = getComputedStyle(el);
    INLINE_PROPS.forEach((p) => {
      const val = cs.getPropertyValue(p);
      if (val) dstEls[i].style.setProperty(p, val);
    });
  });

  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.style.background = "#ffffff";

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function snapshotCharts(): Promise<() => void> {
  const wrappers = document.querySelectorAll<HTMLElement>(".chart-wrapper");

  await Promise.all([...wrappers].map(async (wrapper) => {
    // Target recharts SVG specifically — lucide icons are also <svg> and come first in the DOM
    const svg =
      wrapper.querySelector<SVGSVGElement>("svg.recharts-surface") ??
      wrapper.querySelector<SVGSVGElement>(".chart-wrapper__body svg");
    if (!svg) return;

    let img = wrapper.querySelector<HTMLImageElement>(".print-chart-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "print-chart-img";
      wrapper.appendChild(img);
    }

    try {
      img.src = await svgToPng(svg);
    } catch {
      img.remove();
    }
  }));

  return () => {
    document.querySelectorAll<HTMLImageElement>(".print-chart-img").forEach((img) => img.remove());
  };
}
