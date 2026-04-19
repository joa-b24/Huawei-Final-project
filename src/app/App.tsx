import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import EmptyState from "../components/EmptyState";
import InsightPanel from "../components/InsightPanel";
import KPIGrid from "../components/KPIGrid";
import MetricSelector from "../components/MetricSelector";
import ComparisonBarChart from "../components/charts/ComparisonBarChart";
import CorrelationScatter from "../components/charts/CorrelationScatter";
import { loadDataset } from "../data/loadDataset";
import type { DashboardDataset } from "../types/dataset";
import { buildInsights } from "../utils/insights";
import { getMetricDefinition, getMetricOptions } from "../utils/metrics";

const DEFAULT_STATES = ["Nuevo Leon", "Jalisco", "Ciudad de Mexico", "Queretaro"];

export default function App() {
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState("digital_connectivity");
  const [selectedStates, setSelectedStates] = useState<string[]>(DEFAULT_STATES);

  useEffect(() => {
    loadDataset().then(setDataset);
  }, []);

  const metricOptions = useMemo(
    () => (dataset ? getMetricOptions(dataset.metricCatalog) : []),
    [dataset]
  );

  const selectedMetric = useMemo(
    () => (dataset ? getMetricDefinition(dataset.metricCatalog, selectedMetricId) : null),
    [dataset, selectedMetricId]
  );

  const filteredRecords = useMemo(() => {
    if (!dataset) {
      return [];
    }

    return dataset.records.filter((record) => selectedStates.includes(record.state));
  }, [dataset, selectedStates]);

  const topStates = useMemo(() => {
    return [...filteredRecords]
      .sort((left, right) => right.metrics[selectedMetricId] - left.metrics[selectedMetricId])
      .slice(0, 4);
  }, [filteredRecords, selectedMetricId]);

  const insights = useMemo(() => {
    if (!dataset || !selectedMetric) {
      return [];
    }

    return buildInsights(filteredRecords, selectedMetric);
  }, [dataset, filteredRecords, selectedMetric]);

  const scatterData = useMemo(() => {
    return filteredRecords.map((record) => ({
      state: record.state,
      x: record.metrics.digital_connectivity,
      y: record.metrics.industrial_activity,
      z: record.metrics.population_millions
    }));
  }, [filteredRecords]);

  const toggleState = (stateName: string) => {
    setSelectedStates((currentStates) => {
      if (currentStates.includes(stateName)) {
        return currentStates.filter((item) => item !== stateName);
      }

      return [...currentStates, stateName];
    });
  };

  if (!dataset || !selectedMetric) {
    return <div className="app-shell loading">Cargando dashboard...</div>;
  }

  return (
    <div className="app-shell">
      <DashboardHeader
        title="Huawei Territorial Intelligence"
        subtitle="MVP local para comparar capacidades digitales, industria y contexto territorial en Mexico."
      />

      <section className="panel controls-panel">
        <MetricSelector
          metrics={metricOptions}
          selectedMetricId={selectedMetricId}
          onMetricChange={setSelectedMetricId}
          states={dataset.records.map((record) => record.state)}
          selectedStates={selectedStates}
          onToggleState={toggleState}
        />
      </section>

      <section className="panel">
        {topStates.length > 0 ? (
          <KPIGrid metric={selectedMetric} records={topStates} />
        ) : (
          <EmptyState
            title="Sin datos para esta seleccion"
            description="Activa al menos un estado para recalcular los KPIs y comparativos."
          />
        )}
      </section>

      <section className="grid-layout">
        <div className="panel">
          {filteredRecords.length > 0 ? (
            <ComparisonBarChart records={filteredRecords} metric={selectedMetric} />
          ) : (
            <EmptyState
              title="No hay barras para mostrar"
              description="Los dashboards comparativos se actualizan con los estados seleccionados."
            />
          )}
        </div>

        <div className="panel">
          {scatterData.length > 0 ? (
            <CorrelationScatter data={scatterData} />
          ) : (
            <EmptyState
              title="Sin puntos en la correlacion"
              description="Selecciona al menos un estado para explorar la relacion digital-industrial."
            />
          )}
        </div>
      </section>

      <section className="panel">
        <InsightPanel insights={insights} />
      </section>
    </div>
  );
}
