export type OlsResult = {
  intercept: number;
  betas: number[];
  se: number[];
  tStats: number[];
  pValues: number[];
  r2: number;
  r2adj: number;
  fStat: number;
  fPValue: number;
  residuals: number[];
  fitted: number[];
};

// ── Matrix helpers ──────────────────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  const [m, n] = [A.length, A[0].length];
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => A[j][i])
  );
}

function matMul(A: number[][], B: number[][]): number[][] {
  const [m, k, n] = [A.length, A[0].length, B[0].length];
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      Array.from({ length: k }, (_, p) => A[i][p] * B[p][j]).reduce((a, b) => a + b, 0)
    )
  );
}

function matVec(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const aug = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const f = aug[row][col];
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
      }
    }
  }
  return aug.map((row) => row.slice(n));
}

// ── Statistics ──────────────────────────────────────────────────────────────

function lgamma(x: number): number {
  const C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = C[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += C[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x > (a + 1) / (a + b + 2)) return 1 - betaInc(1 - x, b, a);
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  const EPS = 1e-30;
  let f = 1, C = 1;
  let D = 1 - ((a + b) * x) / (a + 1);
  D = 1 / (Math.abs(D) < EPS ? EPS : D);
  f = D;
  for (let m = 1; m <= 200; m++) {
    let d = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + d * D; D = 1 / (Math.abs(D) < EPS ? EPS : D);
    C = 1 + d / (Math.abs(C) < EPS ? EPS : C);
    f *= C * D;
    d = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + d * D; D = 1 / (Math.abs(D) < EPS ? EPS : D);
    C = 1 + d / (Math.abs(C) < EPS ? EPS : C);
    f *= C * D;
    if (Math.abs(C * D - 1) < 1e-10) break;
  }
  return front * f;
}

function tPValue(t: number, df: number): number {
  return Math.min(1, betaInc(df / (df + t * t), df / 2, 0.5));
}

function fPValue(f: number, df1: number, df2: number): number {
  if (f <= 0) return 1;
  return Math.min(1, betaInc(df2 / (df2 + df1 * f), df2 / 2, df1 / 2));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * OLS regression. X_raw is n×k (without intercept column — added internally).
 * Returns null if the system is singular or underdetermined.
 */
export function olsRegression(y: number[], X_raw: number[][]): OlsResult | null {
  const n = y.length;
  const k = X_raw[0]?.length ?? 0;
  if (n < k + 2) return null;

  const X = X_raw.map((row) => [1, ...row]); // add intercept
  const Xt = transpose(X);
  const XtXinv = invertMatrix(matMul(Xt, X));
  if (!XtXinv) return null;

  const Xty = matVec(Xt, y);
  const coeffs = matVec(XtXinv, Xty);

  const fitted = matVec(X, coeffs);
  const residuals = y.map((yi, i) => yi - fitted[i]);

  const df_res = n - k - 1;
  const ssRes = residuals.reduce((s, e) => s + e * e, 0);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const r2adj = 1 - (ssRes / df_res) / (ssTot / (n - 1));
  const s2 = ssRes / df_res;

  const se = XtXinv.map((row, i) => Math.sqrt(row[i] * s2));
  const tStats = coeffs.map((b, i) => (se[i] === 0 ? 0 : b / se[i]));
  const pValues = tStats.map((t) => tPValue(Math.abs(t), df_res));

  const fStat = k === 0 || 1 - r2 === 0 ? 0 : (r2 / k) / ((1 - r2) / df_res);
  const fP = fPValue(fStat, k, df_res);

  return {
    intercept: coeffs[0],
    betas: coeffs.slice(1),
    se: se.slice(1),
    tStats: tStats.slice(1),
    pValues: pValues.slice(1),
    r2,
    r2adj,
    fStat,
    fPValue: fP,
    residuals,
    fitted,
  };
}

/** Variance Inflation Factor per predictor. VIF > 5 indicates collinearity. */
export function calcVif(X_raw: number[][]): number[] {
  const k = X_raw[0]?.length ?? 0;
  if (k <= 1) return new Array(k).fill(1);
  return X_raw[0].map((_, j) => {
    const y_j = X_raw.map((row) => row[j]);
    const X_others = X_raw.map((row) => row.filter((_, i) => i !== j));
    const result = olsRegression(y_j, X_others);
    if (!result || result.r2 >= 1) return Infinity;
    return 1 / (1 - result.r2);
  });
}
