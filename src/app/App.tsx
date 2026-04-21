import { useEffect, useMemo, useState } from "react";
import DashboardFilters from "../components/DashboardFilters";
import DashboardHeader from "../components/DashboardHeader";
import DashboardSection from "../components/DashboardSection";
import EmptyState from "../components/EmptyState";
import ExecutiveInsightList from "../components/ExecutiveInsightList";
import ExecutiveKpiGrid from "../components/ExecutiveKpiGrid";
import OpportunityKpiGrid from "../components/OpportunityKpiGrid";
import ComparisonBarChart from "../components/charts/ComparisonBarChart";
import CorrelationScatter from "../components/charts/CorrelationScatter";
import DumbbellComparisonChart from "../components/charts/DumbbellComparisonChart";
import { loadDataset } from "../data/loadDataset";
import type { DashboardDataset, MetricDefinition, StateMetricRecord } from "../types/dataset";
import { buildOpportunityRecords, getMetricAverage, getTopRecordByMetric } from "../utils/dashboard";
import { getMetricDefinition } from "../utils/metrics";

const DEFAULT_STATES = ["Nuevo Leon", "Jalisco", "Ciudad de Mexico", "Queretaro"];

const TERRITORIAL_MOBILE_IDS = [
  "localidades_con_cobertura_movil_pct",
  "localidades_con_4g_garantizada_pct",
  "localidades_con_5g_garantizada_pct",
  "teledensidad_internet_movil"
];

const POPULATION_COVERAGE_IDS = [
  "poblacion_en_localidades_con_cobertura_movil_pct",
  "poblacion_en_localidades_con_4g_garantizada_pct",
  "poblacion_en_localidades_con_5g_garantizada_pct",
  "poblacion_en_localidades_con_internet_pct",
  "hogares_en_localidades_con_internet_pct"
];

const ADOPTION_COVERAGE_IDS = [
  "personas_usuarias_internet_pct",
  "personas_con_smartphone_pct",
  "personas_conexion_datos_celular_pct",
  "personas_compras_internet_pct",
  "personas_usan_banca_movil_pct"
];

const GAP_METRICS: MetricDefinition[] = [
  {
    id: "brecha_cobertura_movil_pp",
    label: "Brecha poblacion-localidades con cobertura movil",
    unit: "pp",
    category: "Cobertura de red",
    description:
      "Diferencia entre la poblacion cubierta y el porcentaje de localidades con cobertura movil."
  },
  {
    id: "brecha_4g_pp",
    label: "Brecha poblacion-localidades con 4G garantizada",
    unit: "pp",
    category: "Cobertura de red",
    description:
      "Diferencia entre la poblacion cubierta y el porcentaje de localidades con 4G garantizada."
  },
  {
    id: "brecha_5g_pp",
    label: "Brecha poblacion-localidades con 5G garantizada",
    unit: "pp",
    category: "Cobertura de red",
    description:
      "Diferencia entre la poblacion cubierta y el porcentaje de localidades con 5G garantizada."
  }
];

const OPPORTUNITY_SCORE_METRIC: MetricDefinition = {
  id: "opportunityScore",
  label: "Score de oportunidad",
  unit: "pts",
  category: "Cobertura de red",
  description: "Score compuesto para priorizacion ejecutiva."
};

type OpportunityRecord = ReturnType<typeof buildOpportunityRecords>[number];

export default function App() {
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [selectedStates, setSelectedStates] = useState<string[]>(DEFAULT_STATES);
  const [selectedTerritorialMetricId, setSelectedTerritorialMetricId] = useState(
    "localidades_con_4g_garantizada_pct"
  );
  const [selectedPopulationMetricId, setSelectedPopulationMetricId] = useState(
    "poblacion_en_localidades_con_4g_garantizada_pct"
  );
  const [selectedGapMetricId, setSelectedGapMetricId] = useState("brecha_4g_pp");
  const [selectedAdoptionMetricId, setSelectedAdoptionMetricId] = useState(
    "personas_usuarias_internet_pct"
  );
  const [selectedOpportunityMetricId, setSelectedOpportunityMetricId] = useState(
    "personas_compras_internet_pct"
  );

  useEffect(() => {
    loadDataset().then(setDataset);
  }, []);

  const allStates = useMemo(
    () => (dataset ? dataset.records.map((record) => record.state) : []),
    [dataset]
  );

  const filteredRecords = useMemo(() => {
    if (!dataset) {
      return [];
    }

    return dataset.records.filter((record) => selectedStates.includes(record.state));
  }, [dataset, selectedStates]);

  const territorialMetrics = useMemo(
    () => (dataset ? buildMetricOptions(dataset.metricCatalog, TERRITORIAL_MOBILE_IDS) : []),
    [dataset]
  );

  const populationMetrics = useMemo(
    () => (dataset ? buildMetricOptions(dataset.metricCatalog, POPULATION_COVERAGE_IDS) : []),
    [dataset]
  );

  const adoptionMetrics = useMemo(
    () => (dataset ? buildMetricOptions(dataset.metricCatalog, ADOPTION_COVERAGE_IDS) : []),
    [dataset]
  );

  const opportunityMetrics = useMemo(
    () =>
      dataset
        ? buildMetricOptions(dataset.metricCatalog, [
            ...ADOPTION_COVERAGE_IDS,
            "teledensidad_internet_movil",
            "poblacion_en_localidades_con_4g_garantizada_pct",
            "poblacion_en_localidades_con_5g_garantizada_pct"
          ])
        : [],
    [dataset]
  );

  const territorialMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedTerritorialMetricId) : null),
    [dataset, selectedTerritorialMetricId]
  );

  const populationMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedPopulationMetricId) : null),
    [dataset, selectedPopulationMetricId]
  );

  const adoptionMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedAdoptionMetricId) : null),
    [dataset, selectedAdoptionMetricId]
  );

  const opportunityMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedOpportunityMetricId) : null),
    [dataset, selectedOpportunityMetricId]
  );

  const gapMetric = useMemo(
    () => GAP_METRICS.find((metric) => metric.id === selectedGapMetricId) ?? GAP_METRICS[0],
    [selectedGapMetricId]
  );

  const gapRecords = useMemo(() => buildGapRecords(filteredRecords), [filteredRecords]);

  const opportunityRecords = useMemo(
    () => buildOpportunityRecords(filteredRecords),
    [filteredRecords]
  );

  const territorialScatter = useMemo(
    () =>
      filteredRecords.map((record) => ({
        state: record.state,
        x: record.metrics.teledensidad_internet_movil ?? 0,
        y: record.metrics[selectedTerritorialMetricId] ?? 0,
        z: record.metrics.poblacion_en_localidades_con_5g_garantizada_pct ?? 0
      })),
    [filteredRecords, selectedTerritorialMetricId]
  );

  const populationCoveragePair = useMemo(
    () => getPopulationCoveragePair(selectedPopulationMetricId),
    [selectedPopulationMetricId]
  );

  const gapPair = useMemo(() => getGapPair(selectedGapMetricId), [selectedGapMetricId]);

  const adoptionCoveragePair = useMemo(
    () => getAdoptionCoveragePair(selectedAdoptionMetricId),
    [selectedAdoptionMetricId]
  );

  const opportunityScatter = useMemo(
    () =>
      opportunityRecords.map((record) => ({
        state: record.state,
        x: record.opportunityScore,
        y: record.metrics[selectedOpportunityMetricId] ?? 0,
        z: record.metrics.poblacion_en_localidades_con_5g_garantizada_pct ?? 0
      })),
    [opportunityRecords, selectedOpportunityMetricId]
  );

  const territorialInsights = useMemo(
    () => buildTerritorialCoverageInsights(filteredRecords, territorialMetric),
    [filteredRecords, territorialMetric]
  );

  const populationInsights = useMemo(
    () => buildPopulationCoverageInsights(filteredRecords, populationMetric),
    [filteredRecords, populationMetric]
  );

  const gapInsights = useMemo(
    () => buildGapInsights(gapRecords, gapMetric, gapPair),
    [gapMetric, gapPair, gapRecords]
  );

  const adoptionInsights = useMemo(
    () => buildAdoptionInsights(filteredRecords, adoptionMetric, adoptionCoveragePair),
    [adoptionCoveragePair, adoptionMetric, filteredRecords]
  );

  const opportunityInsights = useMemo(
    () => buildOpportunityInsights(opportunityRecords, opportunityMetric),
    [opportunityMetric, opportunityRecords]
  );

  const toggleState = (stateName: string) => {
    setSelectedStates((currentStates) => {
      if (currentStates.includes(stateName)) {
        return currentStates.filter((item) => item !== stateName);
      }

      return [...currentStates, stateName];
    });
  };

  if (!dataset || !territorialMetric || !populationMetric || !adoptionMetric || !opportunityMetric) {
    return <div className="app-shell loading">Cargando dashboards...</div>;
  }

  return (
    <div className="app-shell">
      <DashboardHeader
        title="Propuesta de Dashboards Proyecto Huawei"
        subtitle="Visualizacion ejecutiva para comparar estados de Mexico en cobertura movil, poblacion cubierta, adopcion digital y oportunidad estrategica con base en indicadores territoriales de conectividad."
      />

      <div className="filter-toolbar">
        <button
          className="filter-toggle"
          onClick={() => setFiltersVisible((current) => !current)}
          type="button"
        >
          {filtersVisible ? "Ocultar filtros" : "Mostrar filtros"}
        </button>
        <span className="filter-toolbar-copy">
          {selectedStates.length} estados activos en la muestra
        </span>
      </div>

      {filtersVisible ? (
        <section className="panel controls-panel">
          <DashboardFilters
            states={allStates}
            selectedStates={selectedStates}
            onToggleState={toggleState}
          />
        </section>
      ) : null}

      <DashboardSection
        sectionId="cobertura-territorial"
        title="1. Cobertura territorial movil"
        description="Lectura directa de despliegue territorial para comparar cobertura movil, 4G, 5G y teledensidad entre estados."
        metricOptions={territorialMetrics}
        selectedMetricId={selectedTerritorialMetricId}
        onMetricChange={setSelectedTerritorialMetricId}
      >
        {filteredRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(filteredRecords, territorialMetric, "Estado lider"),
                buildAverageCard(filteredRecords, territorialMetric, "Promedio muestra"),
                {
                  label: "5G poblacional promedio",
                  value: `${getMetricAverage(filteredRecords, "poblacion_en_localidades_con_5g_garantizada_pct").toFixed(1)} %`,
                  helper: "Referencia de cobertura avanzada sobre poblacion",
                  tone: "cool"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={filteredRecords}
                  metric={territorialMetric}
                  title="Ranking territorial"
                  description={`${territorialMetric.label} para los estados seleccionados.`}
                />
              </div>

              <div className="panel panel-nested">
                <CorrelationScatter
                  data={territorialScatter}
                  title="Teledensidad vs despliegue territorial"
                  description="Relacion entre intensidad del servicio movil y cobertura territorial de la variable seleccionada."
                  xLabel="Teledensidad de internet movil"
                  xUnit=""
                  yLabel={territorialMetric.label}
                  yUnit={` ${territorialMetric.unit}`}
                />
              </div>
            </div>

            <div className="panel panel-nested">
              <ExecutiveInsightList
                insights={territorialInsights}
                title="Lecturas clave de cobertura"
                description="Pistas rapidas para detectar liderazgo y rezagos en cobertura territorial movil."
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin muestra de cobertura territorial"
            description="Selecciona estados para comparar cobertura movil, 4G y 5G."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="cobertura-poblacional"
        title="2. Cobertura con peso poblacional"
        description="Lectura de alcance efectivo sobre poblacion y hogares, no solo sobre cantidad de localidades."
        metricOptions={populationMetrics}
        selectedMetricId={selectedPopulationMetricId}
        onMetricChange={setSelectedPopulationMetricId}
      >
        {filteredRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(filteredRecords, populationMetric, "Estado lider"),
                buildAverageCard(filteredRecords, populationMetric, "Promedio muestra"),
                {
                  label: "Base comparada",
                  value: `${getMetricAverage(filteredRecords, populationCoveragePair.baseMetricId).toFixed(1)} %`,
                  helper: `${populationCoveragePair.baseLabel} promedio`,
                  tone: "neutral"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={filteredRecords}
                  metric={populationMetric}
                  title="Cobertura sobre poblacion y hogares"
                  description={`${populationMetric.label} para la muestra seleccionada.`}
                />
              </div>

              <div className="panel panel-nested">
                <DumbbellComparisonChart
                  records={filteredRecords}
                  leftMetricId={populationCoveragePair.baseMetricId}
                  leftLabel={populationCoveragePair.baseLabel}
                  rightMetricId={selectedPopulationMetricId}
                  rightLabel={populationMetric.label}
                  title="Diferencia entre base territorial y alcance efectivo"
                  description={`Comparacion directa entre ${populationCoveragePair.baseLabel.toLowerCase()} y ${populationMetric.label.toLowerCase()} por estado.`}
                  unit="%"
                />
              </div>
            </div>

            <div className="panel panel-nested">
              <ExecutiveInsightList
                insights={populationInsights}
                title="Lecturas clave de poblacion cubierta"
                description="Señales para distinguir entre cobertura aparente y cobertura con peso poblacional."
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin muestra poblacional"
            description="Activa estados para revisar cobertura con peso poblacional."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="brecha-territorial"
        title="3. Brecha territorial de conectividad"
        description="Indicadores derivados para medir si la cobertura avanzada se distribuye de forma amplia o se concentra en pocos polos poblados."
        metricOptions={buildMetricOptions(GAP_METRICS, GAP_METRICS.map((metric) => metric.id))}
        selectedMetricId={selectedGapMetricId}
        onMetricChange={setSelectedGapMetricId}
      >
        {gapRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(gapRecords, gapMetric, "Mayor brecha"),
                buildAverageCard(gapRecords, gapMetric, "Promedio muestra"),
                {
                  label: "Cobertura poblacional asociada",
                  value: `${getMetricAverage(gapRecords, gapPair.coveredMetricId).toFixed(1)} %`,
                  helper: `${gapPair.coveredLabel} promedio`,
                  tone: "cool"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={gapRecords}
                  metric={gapMetric}
                  title="Brecha por estado"
                  description={`${gapMetric.label} para la muestra seleccionada.`}
                />
              </div>

              <div className="panel panel-nested">
                <DumbbellComparisonChart
                  records={gapRecords}
                  leftMetricId={gapPair.baseMetricId}
                  leftLabel={gapPair.baseLabel}
                  rightMetricId={gapPair.coveredMetricId}
                  rightLabel={gapPair.coveredLabel}
                  title="Brecha visible por estado"
                  description="La separacion entre ambos puntos muestra si la cobertura se distribuye de forma amplia o se concentra en poblacion."
                  unit="%"
                />
              </div>
            </div>

            <div className="panel panel-nested">
              <ExecutiveInsightList
                insights={gapInsights}
                title="Lecturas clave de brecha"
                description="Interpretacion inicial de concentracion territorial y dispersion de cobertura."
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin brechas calculadas"
            description="Se necesita al menos un estado activo para estimar las brechas territoriales."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="adopcion-cobertura"
        title="4. Adopcion vs cobertura"
        description="Cruce entre comportamiento digital y base de conectividad para distinguir adopcion madura, infraestructura lista y rezagos de uso."
        metricOptions={adoptionMetrics}
        selectedMetricId={selectedAdoptionMetricId}
        onMetricChange={setSelectedAdoptionMetricId}
      >
        {filteredRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(filteredRecords, adoptionMetric, "Estado lider"),
                buildAverageCard(filteredRecords, adoptionMetric, "Promedio muestra"),
                {
                  label: "Cobertura asociada",
                  value: `${getMetricAverage(filteredRecords, adoptionCoveragePair.coverageMetricId).toFixed(1)} %`,
                  helper: `${adoptionCoveragePair.coverageLabel} promedio`,
                  tone: "cool"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={filteredRecords}
                  metric={adoptionMetric}
                  title="Ranking de adopcion"
                  description={`${adoptionMetric.label} para los estados seleccionados.`}
                />
              </div>

              <div className="panel panel-nested">
                <DumbbellComparisonChart
                  records={filteredRecords}
                  leftMetricId={adoptionCoveragePair.coverageMetricId}
                  leftLabel={adoptionCoveragePair.coverageLabel}
                  rightMetricId={selectedAdoptionMetricId}
                  rightLabel={adoptionMetric.label}
                  title="Cobertura disponible vs adopcion observada"
                  description="La distancia entre ambos puntos ayuda a ver si la adopcion ya acompana a la base de conectividad o si todavia hay espacio por activar."
                  unit={adoptionMetric.unit}
                />
              </div>
            </div>

            <div className="panel panel-nested">
              <ExecutiveInsightList
                insights={adoptionInsights}
                title="Lecturas clave de adopcion"
                description="Señales para detectar desalineaciones entre cobertura disponible y comportamiento digital."
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin relacion adopcion-cobertura"
            description="Selecciona estados para cruzar uso digital con conectividad."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="oportunidad"
        title="5. Oportunidad estrategica"
        description="Score inicial para priorizar estados combinando adopcion TIC, intensidad de servicio movil y cobertura avanzada sobre poblacion."
        metricOptions={opportunityMetrics}
        selectedMetricId={selectedOpportunityMetricId}
        onMetricChange={setSelectedOpportunityMetricId}
      >
        {opportunityRecords.length > 0 ? (
          <>
            <OpportunityKpiGrid records={opportunityRecords} focusMetric={opportunityMetric} />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={opportunityRecords}
                  metric={OPPORTUNITY_SCORE_METRIC}
                  title="Ranking de oportunidad"
                  description="Score compuesto para priorizar territorios desde una lectura ejecutiva."
                />
              </div>

              <div className="panel panel-nested">
                <CorrelationScatter
                  data={opportunityScatter}
                  title="Oportunidad vs variable foco"
                  description={`Cruce entre el score estrategico y ${opportunityMetric.label.toLowerCase()}.`}
                  xLabel="Score de oportunidad"
                  xUnit=" pts"
                  yLabel={opportunityMetric.label}
                  yUnit={` ${opportunityMetric.unit}`}
                />
              </div>
            </div>

            <div className="panel panel-nested">
              <ExecutiveInsightList
                insights={opportunityInsights}
                title="Lecturas clave de oportunidad"
                description="Resumen automatico para orientar una primera priorizacion territorial."
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin score de oportunidad"
            description="Activa estados para calcular el ranking estrategico inicial."
          />
        )}
      </DashboardSection>
    </div>
  );
}

function buildMetricOptions(metricCatalog: MetricDefinition[], metricIds: string[]) {
  return metricIds
    .map((metricId) => metricCatalog.find((metric) => metric.id === metricId))
    .filter((metric): metric is MetricDefinition => Boolean(metric))
    .map((metric) => ({
      id: metric.id,
      label: metric.label,
      category: metric.category
    }));
}

function buildGapRecords(records: StateMetricRecord[]): StateMetricRecord[] {
  return records.map((record) => ({
    ...record,
    metrics: {
      ...record.metrics,
      brecha_cobertura_movil_pp:
        (record.metrics.poblacion_en_localidades_con_cobertura_movil_pct ?? 0) -
        (record.metrics.localidades_con_cobertura_movil_pct ?? 0),
      brecha_4g_pp:
        (record.metrics.poblacion_en_localidades_con_4g_garantizada_pct ?? 0) -
        (record.metrics.localidades_con_4g_garantizada_pct ?? 0),
      brecha_5g_pp:
        (record.metrics.poblacion_en_localidades_con_5g_garantizada_pct ?? 0) -
        (record.metrics.localidades_con_5g_garantizada_pct ?? 0)
    }
  }));
}

function getPopulationCoveragePair(metricId: string) {
  switch (metricId) {
    case "poblacion_en_localidades_con_cobertura_movil_pct":
      return {
        baseMetricId: "localidades_con_cobertura_movil_pct",
        baseLabel: "Localidades con cobertura movil"
      };
    case "poblacion_en_localidades_con_5g_garantizada_pct":
      return {
        baseMetricId: "localidades_con_5g_garantizada_pct",
        baseLabel: "Localidades con 5G garantizada"
      };
    case "poblacion_en_localidades_con_internet_pct":
      return {
        baseMetricId: "hogares_en_localidades_con_internet_pct",
        baseLabel: "Hogares en localidades con internet"
      };
    case "hogares_en_localidades_con_internet_pct":
      return {
        baseMetricId: "poblacion_en_localidades_con_internet_pct",
        baseLabel: "Poblacion en localidades con internet"
      };
    case "poblacion_en_localidades_con_4g_garantizada_pct":
    default:
      return {
        baseMetricId: "localidades_con_4g_garantizada_pct",
        baseLabel: "Localidades con 4G garantizada"
      };
  }
}

function getGapPair(metricId: string) {
  switch (metricId) {
    case "brecha_cobertura_movil_pp":
      return {
        baseMetricId: "localidades_con_cobertura_movil_pct",
        coveredMetricId: "poblacion_en_localidades_con_cobertura_movil_pct",
        baseLabel: "Localidades con cobertura movil",
        coveredLabel: "Poblacion en localidades con cobertura movil"
      };
    case "brecha_5g_pp":
      return {
        baseMetricId: "localidades_con_5g_garantizada_pct",
        coveredMetricId: "poblacion_en_localidades_con_5g_garantizada_pct",
        baseLabel: "Localidades con 5G garantizada",
        coveredLabel: "Poblacion en localidades con 5G garantizada"
      };
    case "brecha_4g_pp":
    default:
      return {
        baseMetricId: "localidades_con_4g_garantizada_pct",
        coveredMetricId: "poblacion_en_localidades_con_4g_garantizada_pct",
        baseLabel: "Localidades con 4G garantizada",
        coveredLabel: "Poblacion en localidades con 4G garantizada"
      };
  }
}

function getAdoptionCoveragePair(metricId: string) {
  switch (metricId) {
    case "personas_con_smartphone_pct":
      return {
        coverageMetricId: "poblacion_en_localidades_con_5g_garantizada_pct",
        coverageLabel: "Poblacion en localidades con 5G garantizada"
      };
    case "personas_conexion_datos_celular_pct":
      return {
        coverageMetricId: "poblacion_en_localidades_con_cobertura_movil_pct",
        coverageLabel: "Poblacion en localidades con cobertura movil"
      };
    case "personas_compras_internet_pct":
    case "personas_usan_banca_movil_pct":
      return {
        coverageMetricId: "poblacion_en_localidades_con_cobertura_movil_pct",
        coverageLabel: "Poblacion en localidades con cobertura movil"
      };
    case "personas_usuarias_internet_pct":
    default:
      return {
        coverageMetricId: "poblacion_en_localidades_con_4g_garantizada_pct",
        coverageLabel: "Poblacion en localidades con 4G garantizada"
      };
  }
}

function buildTerritorialCoverageInsights(
  records: StateMetricRecord[],
  metric: MetricDefinition | null
) {
  if (!metric || records.length === 0) {
    return [];
  }

  const leader = getTopRecordByMetric(records, metric.id);
  const teledensityLeader = getTopRecordByMetric(records, "teledensidad_internet_movil");
  const laggard = [...records].sort(
    (left, right) => (left.metrics[metric.id] ?? 0) - (right.metrics[metric.id] ?? 0)
  )[0];

  return [
    `${leader.state} lidera la muestra en ${metric.label.toLowerCase()}, por lo que marca la referencia territorial inicial.`,
    `${teledensityLeader.state} concentra la mayor teledensidad de internet movil, una señal de intensidad comercial sobre la red.`,
    `${laggard.state} queda al final del comparativo de ${metric.label.toLowerCase()}, lo que sugiere una revision de rezago territorial relativo.`
  ];
}

function buildPopulationCoverageInsights(
  records: StateMetricRecord[],
  metric: MetricDefinition | null
) {
  if (!metric || records.length === 0) {
    return [];
  }

  const leader = getTopRecordByMetric(records, metric.id);
  const average = getMetricAverage(records, metric.id);
  const gapAverage =
    getMetricAverage(records, "poblacion_en_localidades_con_4g_garantizada_pct") -
    getMetricAverage(records, "localidades_con_4g_garantizada_pct");

  return [
    `${leader.state} encabeza ${metric.label.toLowerCase()}, lo que muestra el mayor alcance efectivo sobre poblacion u hogares.`,
    `El promedio simple de la muestra para ${metric.label.toLowerCase()} es ${average.toFixed(1)} ${metric.unit}.`,
    `La diferencia promedio entre poblacion cubierta con 4G y localidades con 4G es de ${gapAverage.toFixed(1)} pp, señal de concentracion urbana de la cobertura avanzada.`
  ];
}

function buildGapInsights(
  records: StateMetricRecord[],
  metric: MetricDefinition,
  gapPair: ReturnType<typeof getGapPair>
) {
  if (records.length === 0) {
    return [];
  }

  const leader = getTopRecordByMetric(records, metric.id);
  const lowest = [...records].sort(
    (left, right) => (left.metrics[metric.id] ?? 0) - (right.metrics[metric.id] ?? 0)
  )[0];
  const average = getMetricAverage(records, metric.id);

  return [
    `${leader.state} presenta la mayor ${metric.label.toLowerCase()}, lo que apunta a una cobertura mas concentrada en zonas pobladas.`,
    `${lowest.state} muestra la brecha mas contenida, una señal de despliegue relativamente mas distribuido en ${gapPair.baseLabel.toLowerCase()}.`,
    `La brecha promedio de la muestra es ${average.toFixed(1)} pp, util para distinguir dispersion territorial frente a concentracion urbana.`
  ];
}

function buildAdoptionInsights(
  records: StateMetricRecord[],
  metric: MetricDefinition | null,
  pair: ReturnType<typeof getAdoptionCoveragePair>
) {
  if (!metric || records.length === 0) {
    return [];
  }

  const adoptionLeader = getTopRecordByMetric(records, metric.id);
  const coverageLeader = getTopRecordByMetric(records, pair.coverageMetricId);
  const averageCoverage = getMetricAverage(records, pair.coverageMetricId);

  return [
    `${adoptionLeader.state} lidera ${metric.label.toLowerCase()}, funcionando como referencia de adopcion digital para la muestra.`,
    `${coverageLeader.state} destaca en ${pair.coverageLabel.toLowerCase()}, por lo que combina mejor base de conectividad para esta lectura.`,
    `El promedio simple de ${pair.coverageLabel.toLowerCase()} es ${averageCoverage.toFixed(1)} %, util para ver si la adopcion se apoya en una base de cobertura suficiente.`
  ];
}

function buildOpportunityInsights(
  records: OpportunityRecord[],
  metric: MetricDefinition | null
) {
  if (!metric || records.length === 0) {
    return [];
  }

  const leader = [...records].sort((left, right) => right.opportunityScore - left.opportunityScore)[0];
  const whitespaceLeader = [...records].sort(
    (left, right) => right.whitespaceScore - left.whitespaceScore
  )[0];
  const marketLeader = [...records].sort(
    (left, right) => right.marketAttractiveness - left.marketAttractiveness
  )[0];

  return [
    `${leader.state} aparece como prioridad inicial al combinar base digital, cobertura avanzada y espacio para profundizar uso transaccional.`,
    `${marketLeader.state} es el referente en atractivo de mercado, mientras ${whitespaceLeader.state} concentra el mayor espacio relativo para activar demanda digital.`,
    `${metric.label} se usa como variable foco para matizar el score y abrir la conversacion sobre expansion comercial o despliegue selectivo.`
  ];
}

function buildTopStateCard(
  records: StateMetricRecord[],
  metric: MetricDefinition,
  label: string
) {
  const topRecord = getTopRecordByMetric(records, metric.id);

  return {
    label,
    value: topRecord ? `${topRecord.metrics[metric.id].toFixed(1)} ${metric.unit}` : "N/D",
    helper: topRecord ? `${topRecord.state} encabeza ${metric.label.toLowerCase()}` : "Sin datos",
    tone: "warm" as const
  };
}

function buildAverageCard(
  records: StateMetricRecord[],
  metric: MetricDefinition,
  label: string
) {
  return {
    label,
    value: `${getMetricAverage(records, metric.id).toFixed(1)} ${metric.unit}`,
    helper: `Referencia promedio para ${metric.label.toLowerCase()}`,
    tone: "neutral" as const
  };
}
