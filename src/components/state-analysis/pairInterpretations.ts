
type Interpretation = {
  positive: string;
  negative: string;
  weak: string;
};

const PAIR_MAP: Record<string, Interpretation> = {
  "graproes|pob_pct_4g_garantizada": {
    positive:
      "Los municipios con mayor escolaridad promedio tenderían a coincidir con mejor cobertura 4G. " +
      "Una posible interpretación es que ambos indicadores estarían capturando un mismo eje subyacente —urbanización, concentración de servicios— " +
      "más que una relación directa entre escolaridad y conectividad. No se podría afirmar causalidad en ninguna dirección.",
    negative:
      "Aparentemente, en este estado, mayor escolaridad iría acompañada de menor cobertura 4G. " +
      "Podría tratarse de un patrón real (por ejemplo, cabeceras educativas en zonas aisladas) o del efecto de pocos municipios atípicos " +
      "moviendo el coeficiente. Conviene mirar la dispersión antes de leerlo como tendencia.",
    weak:
      "No se observaría un patrón claro entre escolaridad y cobertura entre los municipios del estado. " +
      "Podría interpretarse como que ambos indicadores se mueven por dinámicas distintas, o que la cobertura no estaría condicionada al nivel educativo del municipio.",
  },
  "pct_mujeres|pob_pct_4g_garantizada": {
    positive:
      "Mayor proporción de mujeres tendería a coincidir con más cobertura. " +
      "Una posible interpretación es que las cabeceras municipales —con más infraestructura— suelen tener también una composición demográfica " +
      "más estable, mientras que las localidades pequeñas con menos cobertura podrían reflejar migración masculina laboral.",
    negative:
      "La proporción de mujeres sería mayor donde la cobertura es menor. " +
      "Esto podría interpretarse como un reflejo de migración masculina hacia zonas urbanas, dejando comunidades " +
      "demográficamente más femeninas en municipios con menor inversión en infraestructura.",
    weak:
      "La composición por sexo no mostraría asociación clara con la cobertura. " +
      "Podría leerse como que la conectividad no se distribuye según este eje demográfico en este estado.",
  },
  "pct_pob_65_mas|pob_pct_4g_garantizada": {
    positive:
      "Los municipios con más adultos mayores tenderían a coincidir con mejor cobertura. " +
      "Una lectura posible: las cabeceras —que concentran servicios y suelen retener población adulta mayor— " +
      "también tienden a tener mejor infraestructura digital.",
    negative:
      "Los municipios más envejecidos parecerían ser los menos cubiertos. " +
      "Una interpretación coherente con un fenómeno de despoblamiento rural: la población joven migra y permanece " +
      "una población mayor en zonas con menor desarrollo de infraestructura.",
    weak:
      "La proporción de adultos mayores no mostraría relación clara con la cobertura. " +
      "La edad poblacional no parecería ser un buen indicador del rezago digital aquí.",
  },
  "pct_pob_0_14|pob_pct_4g_garantizada": {
    positive:
      "Los municipios con más población infantil tendrían más cobertura. " +
      "Podría interpretarse como zonas urbanas en crecimiento demográfico que también concentran inversión en telecomunicaciones.",
    negative:
      "Donde habría más niños y niñas, la cobertura suele ser menor. " +
      "Una lectura coherente con zonas rurales que mantienen mayor natalidad pero menor inversión en infraestructura digital.",
    weak:
      "La proporción de población infantil no mostraría patrón claro respecto a la cobertura en este estado.",
  },
  "pct_pob_15_64|pob_pct_4g_garantizada": {
    positive:
      "Mayor proporción en edad productiva tendería a coincidir con mejor cobertura. " +
      "Una posible interpretación es que la fuerza laboral se concentra donde hay infraestructura, " +
      "patrón habitual en procesos de urbanización.",
    negative:
      "Donde habría más población en edad productiva, la cobertura sería menor. " +
      "Es un patrón menos común; podría reflejar municipios con actividad industrial o agrícola intensiva en zonas geográficamente complejas.",
    weak:
      "La proporción en edad productiva no se asociaría con la cobertura en este estado.",
  },
  "graproes|pct_pob_65_mas": {
    positive:
      "Mayor escolaridad coincidiría con más adultos mayores. " +
      "Podría interpretarse como cabeceras históricas con servicios consolidados que retienen tanto población mayor como capital humano.",
    negative:
      "Mayor escolaridad coincidiría con menos adultos mayores. " +
      "Un patrón coherente con municipios urbanos jóvenes en crecimiento frente a rurales envejecidos con menor escolaridad histórica.",
    weak:
      "No se observaría relación clara entre escolaridad promedio y proporción de adultos mayores.",
  },
  "graproes|pct_pob_0_14": {
    positive:
      "Mayor escolaridad coincidiría con más niños. " +
      "Resultado relativamente poco común; podría tratarse de ciudades jóvenes con buena infraestructura educativa.",
    negative:
      "Mayor escolaridad coincidiría con menos niños. " +
      "Es el patrón clásico asociado a transición demográfica: a mayor nivel educativo, menor fecundidad observada.",
    weak:
      "No habría patrón claro entre escolaridad y proporción infantil en este estado.",
  },
  "graproes|pct_mujeres": {
    positive:
      "Mayor escolaridad coincidiría con más mujeres proporcionalmente. " +
      "Podría reflejar cabeceras educativas que retienen población femenina, o municipios con economía de servicios.",
    negative:
      "Mayor escolaridad coincidiría con menor proporción de mujeres. " +
      "Una interpretación posible sería municipios con perfil industrial o minero, que históricamente atraen migración masculina.",
    weak:
      "Escolaridad y composición por sexo no parecerían moverse juntas en este estado.",
  },
  "pct_pob_65_mas|pct_pob_0_14": {
    positive:
      "Más adultos mayores y más niños tenderían a coexistir. " +
      "Patrón coherente con una estructura demográfica tipo \"reloj de arena\", típica de comunidades con emigración de adultos jóvenes.",
    negative:
      "Donde habría más adultos mayores, habría menos niños. " +
      "Es el patrón esperable en una transición demográfica avanzada.",
    weak:
      "Las proporciones de adultos mayores y niños no se moverían de forma sistemática entre municipios.",
  },
};

function pairKey(a: string, b: string): string | null {
  const k1 = `${a}|${b}`;
  const k2 = `${b}|${a}`;
  if (PAIR_MAP[k1]) return k1;
  if (PAIR_MAP[k2]) return k2;
  return null;
}

export function getPairInterpretation(
  a: string,
  b: string,
  rho: number | null
): string | null {
  if (a === b) return null;
  const key = pairKey(a, b);
  if (!key) return null;
  const interp = PAIR_MAP[key];
  if (rho === null) return interp.weak;
  if (Math.abs(rho) < 0.2) return interp.weak;
  return rho > 0 ? interp.positive : interp.negative;
}
