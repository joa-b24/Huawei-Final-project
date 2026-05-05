import { useState } from "react";
import type { VariableCatalogEntry } from "../../types/dataStandard";
import type { OperationType } from "../../lib/dataStorage";
import type { ParsedRow } from "../../lib/csvParser";
import Step1OperationType from "./steps/Step1OperationType";
import Step2Variable from "./steps/Step2Variable";
import Step3FileUpload from "./steps/Step3FileUpload";
import Step4Confirm from "./steps/Step4Confirm";

type Props = {
  catalog: VariableCatalogEntry[];
  initialVariable?: VariableCatalogEntry;
  onDone: () => void;
};

const STEP_LABELS = ["Operación", "Variable", "Archivo", "Confirmar"];

export default function OperationWizard({ catalog, initialVariable, onDone }: Props) {
  const [step, setStep] = useState(initialVariable ? 1 : 0);
  const [operation, setOperation] = useState<OperationType | null>(null);
  const [variable, setVariable] = useState<VariableCatalogEntry | null>(initialVariable ?? null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);

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
        <Step1OperationType
          selected={operation}
          onChange={setOperation}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && operation && (
        <Step2Variable
          operation={operation}
          catalog={catalog}
          selected={variable}
          onSelect={setVariable}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && operation && variable && (
        <Step3FileUpload
          operation={operation}
          variableId={variable.variable_id}
          onParsed={(rows, headers) => { setParsedRows(rows); setParsedHeaders(headers); }}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          hasData={parsedRows.length > 0}
        />
      )}
      {step === 3 && operation && variable && (
        <Step4Confirm
          operation={operation}
          variable={variable}
          rows={parsedRows}
          onBack={() => setStep(2)}
          onDone={onDone}
        />
      )}
    </div>
  );
}
