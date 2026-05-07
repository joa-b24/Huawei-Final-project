function rankAverage(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let pos = 0;
  while (pos < indexed.length) {
    let end = pos;
    while (end < indexed.length && indexed[end].v === indexed[pos].v) {
      end++;
    }
    const avg = (pos + 1 + end) / 2;
    for (let k = pos; k < end; k++) {
      ranks[indexed[k].i] = avg;
    }
    pos = end;
  }
  return ranks;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) {
    return Number.NaN;
  }
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const va = a[i] - ma;
    const vb = b[i] - mb;
    num += va * vb;
    da += va * va;
    db += vb * vb;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? Number.NaN : num / den;
}

/** Correlación de Spearman; requiere al menos 5 pares válidos (como el pipeline Python). */
export function spearmanSafe(xs: number[], ys: number[]): number | null {
  const xv: number[] = [];
  const yv: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xv.push(x);
      yv.push(y);
    }
  }
  if (xv.length < 5) {
    return null;
  }
  const rx = rankAverage(xv);
  const ry = rankAverage(yv);
  const r = pearson(rx, ry);
  return Number.isFinite(r) ? r : null;
}
