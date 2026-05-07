// Derived from data/catalogs/states.master.json — maps lowercased/no-accent variants to canonical estado name.
const STATE_ALIASES: Record<string, string> = {
  // Aguascalientes
  aguascalientes: "Aguascalientes",
  ags: "Aguascalientes",

  // Baja California
  "baja california": "Baja California",
  "baja california norte": "Baja California",
  bcn: "Baja California",

  // Baja California Sur
  "baja california sur": "Baja California Sur",
  bcs: "Baja California Sur",

  // Campeche
  campeche: "Campeche",
  cam: "Campeche",

  // Coahuila
  coahuila: "Coahuila",
  "coahuila de zaragoza": "Coahuila",
  coa: "Coahuila",

  // Colima
  colima: "Colima",
  col: "Colima",

  // Chiapas
  chiapas: "Chiapas",
  chp: "Chiapas",

  // Chihuahua
  chihuahua: "Chihuahua",
  "estado de chihuahua": "Chihuahua",
  chh: "Chihuahua",

  // Ciudad de México
  "ciudad de mexico": "Ciudad de Mexico",
  cdmx: "Ciudad de Mexico",
  "distrito federal": "Ciudad de Mexico",
  df: "Ciudad de Mexico",
  cmx: "Ciudad de Mexico",

  // Durango
  durango: "Durango",
  dur: "Durango",

  // Guanajuato
  guanajuato: "Guanajuato",
  gua: "Guanajuato",
  gto: "Guanajuato",

  // Guerrero
  guerrero: "Guerrero",
  gro: "Guerrero",

  // Hidalgo
  hidalgo: "Hidalgo",
  hid: "Hidalgo",

  // Jalisco
  jalisco: "Jalisco",
  jal: "Jalisco",

  // Estado de México
  mexico: "Mexico",
  "estado de mexico": "Mexico",
  edomex: "Mexico",
  mex: "Mexico",

  // Michoacán
  michoacan: "Michoacan",
  "michoacan de ocampo": "Michoacan",
  mic: "Michoacan",
  mich: "Michoacan",

  // Morelos
  morelos: "Morelos",
  mor: "Morelos",

  // Nayarit
  nayarit: "Nayarit",
  nay: "Nayarit",

  // Nuevo León
  "nuevo leon": "Nuevo Leon",
  "n.l.": "Nuevo Leon",
  nle: "Nuevo Leon",
  nl: "Nuevo Leon",

  // Oaxaca
  oaxaca: "Oaxaca",
  oax: "Oaxaca",

  // Puebla
  puebla: "Puebla",
  pue: "Puebla",

  // Querétaro
  queretaro: "Queretaro",
  "queretaro de arteaga": "Queretaro",
  que: "Queretaro",
  qro: "Queretaro",

  // Quintana Roo
  "quintana roo": "Quintana Roo",
  roo: "Quintana Roo",
  qroo: "Quintana Roo",

  // San Luis Potosí
  "san luis potosi": "San Luis Potosi",
  slp: "San Luis Potosi",

  // Sinaloa
  sinaloa: "Sinaloa",
  sin: "Sinaloa",

  // Sonora
  sonora: "Sonora",
  son: "Sonora",

  // Tabasco
  tabasco: "Tabasco",
  tab: "Tabasco",

  // Tamaulipas
  tamaulipas: "Tamaulipas",
  tam: "Tamaulipas",
  tamps: "Tamaulipas",

  // Tlaxcala
  tlaxcala: "Tlaxcala",
  tla: "Tlaxcala",

  // Veracruz
  veracruz: "Veracruz",
  "veracruz de ignacio de la llave": "Veracruz",
  ver: "Veracruz",

  // Yucatán
  yucatan: "Yucatan",
  yuc: "Yucatan",

  // Zacatecas
  zacatecas: "Zacatecas",
  zac: "Zacatecas",
};

// Maps common free-text labels to canonical variable_id values from variables.catalog.json.
const VARIABLE_ALIASES: Record<string, string> = {
  // infraestructura_digital
  "usuarios internet": "personas_usuarias_internet_pct",
  "uso de internet": "personas_usuarias_internet_pct",
  "usuarios computadora": "personas_usuarias_computadora_pct",
  "uso de computadora": "personas_usuarias_computadora_pct",
  "compras internet": "personas_compras_internet_pct",
  "pagos internet": "personas_pagos_internet_pct",
  "banca electronica": "personas_banca_electronica_pct",
  "banca movil": "personas_usan_banca_movil_pct",
  "redes sociales": "personas_usan_redes_sociales_pct",

  // cobertura_red
  "internet movil": "personas_conexion_internet_movil_pct",
  smartphone: "personas_con_smartphone_pct",
  celular: "personas_con_celular_pct",
  "datos celulares": "personas_conexion_datos_celular_pct",
  teledensidad: "teledensidad_internet_movil",
  "cobertura movil": "localidades_con_cobertura_movil_pct",
  "cobertura 4g": "localidades_con_4g_garantizada_pct",
  "cobertura 5g": "localidades_con_5g_garantizada_pct",

  // bienestar_social
  pobreza: "pobreza_pct",
  "pobreza extrema": "pobreza_extrema_pct",
  "rezago educativo": "rezago_educativo_pct",
  "carencia salud": "carencia_salud_pct",

  // economia
  pib: "pib_total",
  "pib per capita": "pib_per_capita",

  // demografia
  poblacion: "poblacion_total",
  "poblacion total": "poblacion_total",
};

export function slugifyLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeStateName(rawStateName: string): string {
  const key = rawStateName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  return STATE_ALIASES[key] ?? toTitleCase(key);
}

export function normalizeVariableName(rawVariableName: string): string {
  const key = rawVariableName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  return VARIABLE_ALIASES[key] ?? slugifyLabel(key);
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
