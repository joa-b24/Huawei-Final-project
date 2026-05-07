/**
 * Gini y curva de Lorenz ponderados por población, análogo a scripts/build_municipal_analytics.py
 */
export function weightedGini(values: number[], weights: number[]): number {
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.w) && p.w > 0);
  if (pairs.length === 0) {
    return Number.NaN;
  }
  pairs.sort((a, b) => a.v - b.v);
  const v = pairs.map((p) => p.v);
  const w = pairs.map((p) => p.w);
  const cw: number[] = [0];
  const cx: number[] = [0];
  for (let i = 0; i < w.length; i++) {
    cw.push(cw[cw.length - 1] + w[i]);
    cx.push(cx[cx.length - 1] + v[i] * w[i]);
  }
  const totalW = cw[cw.length - 1];
  const totalXW = cx[cx.length - 1];
  if (totalXW <= 0) {
    return 0;
  }
  const cwN = cw.map((x) => x / totalW);
  const cxN = cx.map((x) => x / totalXW);
  let area = 0;
  for (let i = 1; i < cwN.length; i++) {
    area += ((cxN[i] + cxN[i - 1]) * (cwN[i] - cwN[i - 1])) / 2;
  }
  return 1 - 2 * area;
}

export type LorenzPoint = {
  popShare: number;
  lorenz: number;
  equality: number;
};

export function lorenzCurve(values: number[], weights: number[]): LorenzPoint[] {
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.w) && p.w > 0);
  if (pairs.length === 0) {
    return [];
  }
  pairs.sort((a, b) => a.v - b.v);
  const v = pairs.map((p) => p.v);
  const w = pairs.map((p) => p.w);
  const cw: number[] = [0];
  const cx: number[] = [0];
  for (let i = 0; i < w.length; i++) {
    cw.push(cw[cw.length - 1] + w[i]);
    cx.push(cx[cx.length - 1] + v[i] * w[i]);
  }
  const totalW = cw[cw.length - 1];
  const totalXW = cx[cx.length - 1];
  if (totalXW <= 0) {
    return cw.map((_, i) => ({
      popShare: cw[i] / totalW,
      lorenz: 0,
      equality: cw[i] / totalW
    }));
  }
  return cw.map((c, i) => {
    const ps = c / totalW;
    return {
      popShare: ps,
      lorenz: cx[i] / totalXW,
      equality: ps
    };
  });
}
