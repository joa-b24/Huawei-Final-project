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
import RadarProfileChart from "../components/charts/RadarProfileChart";
import { loadDataset } from "../data/loadDataset";
import type { DashboardDataset, MetricDefinition, StateMetricRecord } from "../types/dataset";
import {
  buildExecutiveInsights,
  buildOpportunityRecords,
  categoryLabels,
  getCategoryMetrics,
  getMetricAverage,
  getTopRecordByMetric
} from "../utils/dashboard";
import { getMetricDefinition } from "../utils/metrics";

const DEFAULT_STATES = ["Nuevo Leon", "Jalisco", "Ciudad de Mexico", "Queretaro"];

export default function App() {
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>(DEFAULT_STATES);
  const [selectedInfraMetricId, setSelectedInfraMetricId] = useState("digital_connectivity");
  const [selectedTerritorialMetricId, setSelectedTerritorialMetricId] = useState(
    "population_millions"
  );
  const [selectedOpportunityMetricId, setSelectedOpportunityMetricId] =
    useState("industrial_activity");

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

  const infrastructureMetrics = useMemo(
    () => (dataset ? getCategoryMetrics(dataset.metricCatalog, "Infraestructura digital") : []),
    [dataset]
  );

  const territorialMetrics = useMemo(
    () => (dataset ? getCategoryMetrics(dataset.metricCatalog, "Contexto territorial") : []),
    [dataset]
  );

  const opportunityMetrics = useMemo(
    () =>
      dataset
        ? getCategoryMetrics(dataset.metricCatalog, "Industria").concat(
            getCategoryMetrics(dataset.metricCatalog, "Infraestructura digital"),
            getCategoryMetrics(dataset.metricCatalog, "Cobertura de red"),
            getCategoryMetrics(dataset.metricCatalog, "Contexto territorial")
          )
        : [],
    [dataset]
  );

  const infraMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedInfraMetricId) : null),
    [dataset, selectedInfraMetricId]
  );

  const territorialMetric = useMemo(
    () =>
      dataset ? getMetricDefinition(dataset.metricCatalog, selectedTerritorialMetricId) : null,
    [dataset, selectedTerritorialMetricId]
  );

  const opportunityFocusMetric = useMemo(
    () =>
      dataset ? getMetricDefinition(dataset.metricCatalog, selectedOpportunityMetricId) : null,
    [dataset, selectedOpportunityMetricId]
  );

  const opportunityRecords = useMemo(
    () => buildOpportunityRecords(filteredRecords),
    [filteredRecords]
  );

  const infrastructureRadarMetrics = useMemo(
    () => infrastructureMetrics.map((metric) => metric.id),
    [infrastructureMetrics]
  );

  const territorialScatter = useMemo(
    () =>
      filteredRecords.map((record) => ({
        state: record.state,
        x: record.metrics.population_millions,
        y: record.metrics.urbanization_rate,
        z: record.metrics.digital_connectivity
      })),
    [filteredRecords]
  );

  const opportunityScatter = useMemo(
    () =>
      opportunityRecords.map((record) => ({
        state: record.state,
        x: record.opportunityScore,
        y: record.metrics[selectedOpportunityMetricId] ?? 0,
        z: record.metrics.population_millions
      })),
    [opportunityRecords, selectedOpportunityMetricId]
  );

  const executiveInsights = useMemo(
    () => buildExecutiveInsights(filteredRecords, opportunityRecords),
    [filteredRecords, opportunityRecords]
  );

  const toggleState = (stateName: string) => {
    setSelectedStates((currentStates) => {
      if (currentStates.includes(stateName)) {
        return currentStates.filter((item) => item !== stateName);
      }

      return [...currentStates, stateName];
    });
  };

  if (!dataset || !infraMetric || !territorialMetric || !opportunityFocusMetric) {
    return <div className="app-shell loading">Cargando dashboards...</div>;
  }

  return (
    <div className="app-shell">
      <DashboardHeader
        title="Huawei Territorial Intelligence"
        subtitle="Primera version de una plataforma analitica para comparar estados, detectar brechas digitales y priorizar oportunidades estrategicas en Mexico."
      />

      <section className="panel controls-panel">
        <DashboardFilters
          states={allStates}
          selectedStates={selectedStates}
          onToggleState={toggleState}
        />
      </section>

      <DashboardSection
        sectionId="infraestructura"
        title="Dashboard de infraestructura digital"
        description="Lectura comparativa de conectividad y cobertura digital para evaluar madurez territorial."
        metricOptions={infrastructureMetrics}
        selectedMetricId={selectedInfraMetricId}
        onMetricChange={setSelectedInfraMetricId}
      >
        {filteredRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(filteredRecords, infraMetric, "Estado lider"),
                buildAverageCard(filteredRecords, infraMetric, "Promedio muestra"),
                {
                  label: "Cobertura del analisis",
                  value: `${filteredRecords.length}`,
                  helper: "Estados comparados en este corte",
                  tone: "neutral"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={filteredRecords}
                  metric={infraMetric}
                  title="Comparativo entre estados"
                  description={`${infraMetric.label} para la muestra seleccionada.`}
                />
              </div>

              <div className="panel panel-nested">
                <RadarProfileChart
                  records={filteredRecords}
                  metricIds={infrastructureRadarMetrics}
                  metricCatalog={dataset.metricCatalog}
                  title="Perfil digital por estado"
                  description="Vista multivariable para comparar conectividad y cobertura en un solo plano."
                />
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin estados seleccionados"
            description="Activa al menos un estado para visualizar infraestructura digital."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="territorial"
        title="Dashboard de contexto territorial"
        description="Contexto demografico y urbano para dimensionar escala, densidad de demanda y condiciones de despliegue."
        metricOptions={territorialMetrics}
        selectedMetricId={selectedTerritorialMetricId}
        onMetricChange={setSelectedTerritorialMetricId}
      >
        {filteredRecords.length > 0 ? (
          <>
            <ExecutiveKpiGrid
              cards={[
                buildTopStateCard(filteredRecords, territorialMetric, "Mayor escala territorial"),
                buildAverageCard(filteredRecords, territorialMetric, "Promedio muestra"),
                {
                  label: "Lectura complementaria",
                  value: `${getMetricAverage(filteredRecords, "urbanization_rate").toFixed(1)} %`,
                  helper: "Urbanizacion promedio de la muestra",
                  tone: "cool"
                }
              ]}
            />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={filteredRecords}
                  metric={territorialMetric}
                  title="Comparativo territorial"
                  description={`${territorialMetric.label} por estado para interpretar escala relativa.`}
                />
              </div>

              <div className="panel panel-nested">
                <CorrelationScatter
                  data={territorialScatter}
                  title="Escala vs urbanizacion"
                  description="Cada punto combina tamano poblacional, urbanizacion y madurez digital."
                  xLabel="Poblacion"
                  xUnit=" M"
                  yLabel="Urbanizacion"
                  yUnit="%"
                />
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin muestra territorial"
            description="Selecciona estados para explorar contexto poblacional y urbano."
          />
        )}
      </DashboardSection>

      <DashboardSection
        sectionId="oportunidad"
        title="Dashboard de oportunidad estrategica"
        description="Score inicial para detectar territorios con buena combinacion de atractivo industrial, escala de mercado y espacio de mejora digital."
        metricOptions={opportunityMetrics}
        selectedMetricId={selectedOpportunityMetricId}
        onMetricChange={setSelectedOpportunityMetricId}
      >
        {opportunityRecords.length > 0 ? (
          <>
            <OpportunityKpiGrid records={opportunityRecords} focusMetric={opportunityFocusMetric} />

            <div className="grid-layout">
              <div className="panel panel-nested">
                <ComparisonBarChart
                  records={opportunityRecords}
                  metric={opportunityScoreMetric}
                  title="Ranking de oportunidad"
                  description="Score compuesto para priorizar territorios desde una optica ejecutiva."
                />
              </div>

              <div className="panel panel-nested">
                <CorrelationScatter
                  data={opportunityScatter}
                  title="Oportunidad vs variable foco"
                  description={`Relacion entre el score estrategico y ${opportunityFocusMetric.label.toLowerCase()}.`}
                  xLabel="Score de oportunidad"
                  xUnit=" pts"
                  yLabel={opportunityFocusMetric.label}
                  yUnit={` ${opportunityFocusMetric.unit}`}
                />
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin score de oportunidad"
            description="Activa estados para calcular el ranking estrategico inicial."
          />
        )}
      </DashboardSection>

      <section className="panel">
        <ExecutiveInsightList insights={executiveInsights} />
      </section>
    </div>
  );
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
    helper: `Promedio de ${categoryLabels[metric.category] ?? metric.category}`,
    tone: "neutral" as const
  };
}

const opportunityScoreMetric: MetricDefinition = {
  id: "opportunityScore",
  label: "Score de oportunidad",
  unit: "pts",
  category: "Oportunidad estrategica",
  description: "Score compuesto para priorizacion ejecutiva."
};
