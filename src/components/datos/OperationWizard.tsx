import { useState } from "react";
import type { VariableCatalogEntry } from "../../types/dataStandard";
import type { ParsedRow } from "../../lib/csvParser";
import Step1Granularity, { type Granularity } from "./steps/Step1OperationType";
import Step2Variable from "./steps/Step2Variable";
import Step3FileUpload from "./steps/Step3FileUpload";
import Step4Confirm from "./steps/Step4Confirm";

type Props = {
  catalog: VariableCatalogEntry[];
  initialVariable?: VariableCatalogEntry;
  metricYears: Record<string, number>;
  onDone: () => void;
};

const STEP_LABELS = ["Granularidad", "Variable", "Archivo", "Confirmar"];

export default function OperationWizard({ catalog, initialVariable, metricYears, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [granularity, setGranularity] = useState<Granularity | null>(null);
  const [isNew, setIsNew] = useState<boolean | null>(initialVariable ? false : null);
  const [completarOnly, setCompletarOnly] = useState(false);
  const [variable, setVariable] = useState<VariableCatalogEntry | null>(initialVariable ?? null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const existingYear =
    isNew === false && variable ? metricYears[variable.variable_id] : undefined;

  return (
    <div className="wizard">
      <div className="wizard-stepper">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`wizard-step${i === step ? " active" : i < step ? " done" : ""}`}
          >
            {i < step ? "✓ " : `${i + 1}. `}{label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Step1Granularity
          selected={granularity}
          onChange={setGranularity}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && granularity && (
        <Step2Variable
          granularity={granularity}
          catalog={catalog}
          initialVariable={initialVariable}
          selected={variable}
          onSelect={setVariable}
          isNew={isNew}
          onSetIsNew={setIsNew}
          completarOnly={completarOnly}
          onSetCompletarOnly={setCompletarOnly}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && granularity && variable && (
        <Step3FileUpload
          granularity={granularity}
          variableId={variable.variable_id}
          onParsed={(rows) => setParsedRows(rows)}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          hasData={parsedRows.length > 0}
        />
      )}
      {step === 3 && granularity && variable && (
        <Step4Confirm
          granularity={granularity}
          isNew={isNew === true}
          completarOnly={completarOnly}
          variable={variable}
          existingYear={existingYear}
          rows={parsedRows}
          onBack={() => setStep(2)}
          onDone={onDone}
        />
      )}
    </div>
  );
}
