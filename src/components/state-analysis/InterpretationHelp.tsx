import { useId, useState, type ReactNode } from "react";

type Props = {
  /** Tema del bloque (accesibilidad y texto visible junto al ícono). */
  topic: string;
  /** Título dentro del panel al abrir. */
  heading?: string;
  /** Texto corto al lado del botón (por defecto: «Qué significa: {topic}»). */
  caption?: string;
  children: ReactNode;
};

/**
 * Botón circular con «i» legible: al pulsar muestra explicación (children dinámico).
 */
export default function InterpretationHelp({ topic, heading, caption, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const label = caption ?? `Qué significa: ${topic}`;

  return (
    <div className="interpretation-help">
      <div className="interpretation-help__row">
        <span className="interpretation-help__caption">{label}</span>
        <button
          type="button"
          className={`interpretation-help__btn${open ? " interpretation-help__btn--open" : ""}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Ocultar explicación: ${topic}` : `Mostrar explicación: ${topic}`}
          title={open ? "Ocultar ayuda" : "Ayuda: qué significa esto"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="interpretation-help__i-char" aria-hidden>
            i
          </span>
        </button>
      </div>
      {open ? (
        <div
          id={panelId}
          className="interpretation-help__panel"
          role="region"
          aria-label={`Explicación: ${topic}`}
        >
          {heading ? <p className="interpretation-help__heading">{heading}</p> : null}
          <div className="interpretation-help__content">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
