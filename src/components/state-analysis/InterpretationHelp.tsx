import { HelpCircle } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

type Props = {
  topic: string;
  heading?: string;
  caption?: string;
  children: ReactNode;
};

export default function InterpretationHelp({ topic, heading, caption, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const label = caption ?? `Glosario · ${topic}`;

  return (
    <div className="interpretation-help">
      <button
        type="button"
        className={`interpretation-help__btn${open ? " interpretation-help__btn--open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `Ocultar: ${topic}` : `Mostrar: ${topic}`}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={13} />
        <span>{label}</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="interpretation-help__panel"
          role="region"
          aria-label={`Explicación: ${topic}`}
        >
          {heading && <p className="interpretation-help__heading">{heading}</p>}
          <div className="interpretation-help__content">{children}</div>
        </div>
      )}
    </div>
  );
}
