// Maps every known form of a Mexican state identifier → internal 2-letter code.
// Covers: CVE_ENT numeric (1-32, zero-padded or not), INEGI abbreviations,
// full INEGI names, and common aliases/short forms.

const RAW: Record<string, string> = {
  // ── Aguascalientes ──────────────────────────────────────────────
  "1": "AGS", "01": "AGS", "AGS": "AGS",
  "AGUASCALIENTES": "AGS",

  // ── Baja California ─────────────────────────────────────────────
  "2": "BCN", "02": "BCN", "BCN": "BCN", "BC": "BCN",
  "BAJA CALIFORNIA": "BCN",

  // ── Baja California Sur ─────────────────────────────────────────
  "3": "BCS", "03": "BCS", "BCS": "BCS",
  "BAJA CALIFORNIA SUR": "BCS",

  // ── Campeche ─────────────────────────────────────────────────────
  "4": "CAM", "04": "CAM", "CAM": "CAM",
  "CAMPECHE": "CAM",

  // ── Coahuila ─────────────────────────────────────────────────────
  "5": "COA", "05": "COA", "COA": "COA",
  "COAHUILA": "COA", "COAHUILA DE ZARAGOZA": "COA",

  // ── Colima ───────────────────────────────────────────────────────
  "6": "COL", "06": "COL", "COL": "COL",
  "COLIMA": "COL",

  // ── Chiapas ──────────────────────────────────────────────────────
  "7": "CHP", "07": "CHP", "CHP": "CHP", "CHIS": "CHP",
  "CHIAPAS": "CHP",

  // ── Chihuahua ────────────────────────────────────────────────────
  "8": "CHH", "08": "CHH", "CHH": "CHH", "CHIH": "CHH",
  "CHIHUAHUA": "CHH",

  // ── Ciudad de México ─────────────────────────────────────────────
  "9": "CMX", "09": "CMX", "CMX": "CMX", "CDMX": "CMX", "DF": "CMX", "DIF": "CMX",
  "CIUDAD DE MEXICO": "CMX",
  "DISTRITO FEDERAL": "CMX",

  // ── Durango ──────────────────────────────────────────────────────
  "10": "DUR", "DUR": "DUR", "DGO": "DUR",
  "DURANGO": "DUR",

  // ── Guanajuato ───────────────────────────────────────────────────
  "11": "GUA", "GUA": "GUA", "GTO": "GUA",
  "GUANAJUATO": "GUA",

  // ── Guerrero ─────────────────────────────────────────────────────
  "12": "GRO", "GRO": "GRO",
  "GUERRERO": "GRO",

  // ── Hidalgo ──────────────────────────────────────────────────────
  "13": "HID", "HID": "HID", "HGO": "HID",
  "HIDALGO": "HID",

  // ── Jalisco ──────────────────────────────────────────────────────
  "14": "JAL", "JAL": "JAL",
  "JALISCO": "JAL",

  // ── Estado de México ─────────────────────────────────────────────
  "15": "MEX", "MEX": "MEX", "EDOMEX": "MEX", "EDO MEX": "MEX", "EDO. MEX.": "MEX",
  "MEXICO": "MEX", "ESTADO DE MEXICO": "MEX",

  // ── Michoacán ────────────────────────────────────────────────────
  "16": "MIC", "MIC": "MIC", "MICH": "MIC",
  "MICHOACAN": "MIC", "MICHOACAN DE OCAMPO": "MIC",

  // ── Morelos ──────────────────────────────────────────────────────
  "17": "MOR", "MOR": "MOR",
  "MORELOS": "MOR",

  // ── Nayarit ──────────────────────────────────────────────────────
  "18": "NAY", "NAY": "NAY",
  "NAYARIT": "NAY",

  // ── Nuevo León ───────────────────────────────────────────────────
  "19": "NLE", "NLE": "NLE", "NL": "NLE",
  "NUEVO LEON": "NLE",

  // ── Oaxaca ───────────────────────────────────────────────────────
  "20": "OAX", "OAX": "OAX",
  "OAXACA": "OAX",

  // ── Puebla ───────────────────────────────────────────────────────
  "21": "PUE", "PUE": "PUE",
  "PUEBLA": "PUE",

  // ── Querétaro ────────────────────────────────────────────────────
  "22": "QUE", "QUE": "QUE", "QRO": "QUE",
  "QUERETARO": "QUE", "QUERETARO DE ARTEAGA": "QUE",

  // ── Quintana Roo ─────────────────────────────────────────────────
  "23": "ROO", "ROO": "ROO", "QROO": "ROO",
  "QUINTANA ROO": "ROO",

  // ── San Luis Potosí ──────────────────────────────────────────────
  "24": "SLP", "SLP": "SLP",
  "SAN LUIS POTOSI": "SLP",

  // ── Sinaloa ──────────────────────────────────────────────────────
  "25": "SIN", "SIN": "SIN",
  "SINALOA": "SIN",

  // ── Sonora ───────────────────────────────────────────────────────
  "26": "SON", "SON": "SON",
  "SONORA": "SON",

  // ── Tabasco ──────────────────────────────────────────────────────
  "27": "TAB", "TAB": "TAB",
  "TABASCO": "TAB",

  // ── Tamaulipas ───────────────────────────────────────────────────
  "28": "TAM", "TAM": "TAM",
  "TAMAULIPAS": "TAM",

  // ── Tlaxcala ─────────────────────────────────────────────────────
  "29": "TLA", "TLA": "TLA", "TLX": "TLA",
  "TLAXCALA": "TLA",

  // ── Veracruz ─────────────────────────────────────────────────────
  "30": "VER", "VER": "VER",
  "VERACRUZ": "VER", "VERACRUZ DE IGNACIO DE LA LLAVE": "VER",

  // ── Yucatán ──────────────────────────────────────────────────────
  "31": "YUC", "YUC": "YUC",
  "YUCATAN": "YUC",

  // ── Zacatecas ────────────────────────────────────────────────────
  "32": "ZAC", "ZAC": "ZAC",
  "ZACATECAS": "ZAC",
};

// Normalize: strip accents, uppercase, trim.
function normalize(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function resolveStateCode(raw: string): string | null {
  if (!raw) return null;
  const key = normalize(raw);
  return RAW[key] ?? null;
}

// Column name sets used by the CSV parser to classify columns.
export const GEO_STATE_COLUMNS = new Set([
  "state_code", "estado", "entidad", "entidad_federativa", "entidad federativa",
  "nombre_estado", "nombre estado", "cve_ent", "cvente", "clave_estado",
  "clave estado", "estado_nombre", "nombre_entidad", "entidad_nombre",
]);

export const GEO_MUN_COLUMNS = new Set([
  "cve_mun", "cvegeo", "cve_geo", "clave_municipio", "municipio",
  "nom_mun", "nombre_municipio", "cvemun",
]);

export const YEAR_COLUMNS = new Set([
  "year", "anio", "año", "periodo", "fecha", "date",
]);

export const VALUE_COLUMNS = new Set([
  "value", "valor", "indicador", "dato", "tasa", "porcentaje", "pct",
]);
