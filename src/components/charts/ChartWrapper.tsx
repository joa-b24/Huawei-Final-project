import html2canvas from "html2canvas";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, X } from "lucide-react";
import { patchColorMixOnClone, triggerDownload, tableToCSV } from "../../lib/chartExport";

export type LegendItem = { color: string; label: string };

type Props = {
  title?: string;
  description?: string;
  variableName?: string;
  chartType?: string;
  panelTitle?: string;
  tooltip?: React.ReactNode;
  legend?: LegendItem[];
  headerActions?: React.ReactNode;
  downloadTableData?: Array<Record<string, unknown>>;
  tableLayout?: "side" | "below";
  municipalState?: string;
  standalone?: boolean;
  onDownload?: () => void | Promise<void>;
  onFullscreenChange?: (fullscreen: boolean) => void;
  children: React.ReactNode;
};

export default function ChartWrapper({
  title, description, variableName, chartType, panelTitle, tooltip, legend, headerActions,
  downloadTableData, tableLayout = "side", municipalState, standalone,
  onDownload, onFullscreenChange, children,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function openFS() {
    setFullscreen(true);
    setClosing(false);
    onFullscreenChange?.(true);
  }
  function closeFS() {
    setClosing(true);
    onFullscreenChange?.(false);
    setTimeout(() => { setFullscreen(false); setClosing(false); }, 280);
  }

  function buildSlug(ext: string) {
    const stateSlug = municipalState ? `-${municipalState.replace(/\s+/g, "-").toLowerCase()}` : "";
    return [variableName ?? title, chartType].filter(Boolean).join("-").replace(/\s+/g, "-").toLowerCase() + stateSlug + ext;
  }

  async function handleDownload() {
    if (downloading) return;

    if (onDownload) {
      setDownloading(true);
      try { await onDownload(); }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Error al exportar:", err);
        alert(`Error al exportar: ${msg}`);
      } finally { setDownloading(false); }
      return;
    }

    const target = containerRef.current;
    if (!target) return;

    const table = target.querySelector<HTMLTableElement>(".chart-wrapper__body table:not(.chart-download-table)");
    if (table) {
      const csv = tableToCSV(table);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      triggerDownload(url, buildSlug(".csv"));
      return;
    }

    setDownloading(true);
    try {
      const el = target;
      const pad = 24;

      let tableExtraHeight = 0;
      if (tableLayout === "below") {
        const hiddenTable = el.querySelector<HTMLElement>(".chart-download-table");
        if (hiddenTable) {
          hiddenTable.classList.remove("hidden");
          tableExtraHeight = hiddenTable.scrollHeight + 14;
          hiddenTable.classList.add("hidden");
        }
      }

      // onclone adds padding:24px (all sides) to the cloned element. With border-box the
      // outer box stays the same size so the content area shrinks by pad*2 in both axes,
      // causing content to overflow and be clipped. For standalone (.panel) the CSS already
      // supplies the same padding, so offsetWidth/Height already include it — no compensation.
      // For non-standalone we must enlarge the canvas by pad*2 on each axis.
      // The eyebrow <p> inserted when panelTitle is set shifts content down an extra ~28px.
      const hasOwnPadding = el.classList.contains("panel");
      const paddingCompensation = hasOwnPadding ? 0 : pad * 2;
      const eyebrowCompensation = panelTitle ? 28 : 0;

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: el.offsetWidth + paddingCompensation,
        height: el.offsetHeight + tableExtraHeight + paddingCompensation + eyebrowCompensation,
        onclone: (_, cloned) => {
          patchColorMixOnClone(el, cloned);
          cloned.style.padding = `${pad}px`;
          cloned.style.background = "#ffffff";
          cloned.style.borderRadius = "12px";
          if (panelTitle) {
            const eyebrow = document.createElement("p");
            eyebrow.textContent = panelTitle;
            eyebrow.style.cssText = "margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;";
            cloned.insertBefore(eyebrow, cloned.firstChild);
          }
          const dataTable = cloned.querySelector<HTMLElement>(".chart-download-table");
          if (dataTable) {
            const body = cloned.querySelector<HTMLElement>(".chart-wrapper__body");
            if (tableLayout === "below") {
              dataTable.style.cssText = "display: table; width: 100%; border-collapse: collapse; font-size: 10px; color: #374151; margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;";
              if (body) body.style.display = "block";
              dataTable.querySelectorAll<HTMLElement>("thead th").forEach((th, i) => {
                th.style.cssText = `padding: 5px 8px; background: #f3f4f6; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; text-align: ${i === 0 ? "left" : "right"}; white-space: nowrap;`;
              });
              dataTable.querySelectorAll<HTMLElement>("tbody tr").forEach((tr, ri) => {
                tr.style.background = ri % 2 === 0 ? "#ffffff" : "#f9fafb";
                tr.querySelectorAll<HTMLElement>("td").forEach((td, ci) => {
                  td.style.cssText = `padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 10px; text-align: ${ci === 0 ? "left" : "right"}; white-space: nowrap; color: ${ci === 0 ? "#111827" : "#374151"};`;
                  if (ci === 0) td.style.fontWeight = "600";
                });
              });
            } else {
              dataTable.style.cssText = "display: table; border-collapse: collapse; font-size: 10px; color: #374151; min-width: 180px; flex-shrink: 0; align-self: flex-start;";
              if (body) {
                body.style.display = "flex";
                body.style.flexDirection = "row";
                body.style.alignItems = "flex-start";
                body.style.gap = "16px";
              }
            }
          }
        },
      });
      triggerDownload(canvas.toDataURL("image/png"), buildSlug(".png"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error al exportar:", err);
      alert(`Error al exportar: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }

  const showVarPill = variableName && variableName !== (title ?? "");

  const meta = (isModal = false) => (
    <div className="chart-wrapper__meta">
      <div className="chart-wrapper__meta-left">
        {isModal && chartType && !panelTitle && <p className="chart-wrapper__type">{chartType}</p>}
        {title && <h4 className="chart-wrapper__title">{title}</h4>}
        {showVarPill && <span className="chart-wrapper__var">{variableName}</span>}
        {municipalState && <span className="chart-wrapper__municipal">{municipalState} · Municipal</span>}
        {description && <p className="chart-wrapper__desc">{description}</p>}
      </div>
      {headerActions && <div className="chart-wrapper__meta-right" data-html2canvas-ignore="true">{headerActions}</div>}
    </div>
  );

  const legendEl = legend && legend.length > 0 && (
    <div className="chart-wrapper__legend">
      {legend.map((item) => (
        <span key={item.label} className="chart-wrapper__legend-item">
          <span className="chart-wrapper__legend-dot" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );

  const topbar = (onAction: () => void, actionIcon: React.ReactNode, actionTitle: string) => (
    <div className="chart-wrapper__topbar" data-html2canvas-ignore="true">
      <div className="chart-wrapper__topbar-left">
        {panelTitle && <p className="chart-wrapper__panel-title">{panelTitle}</p>}
        {tooltip}
      </div>
      <div className="chart-wrapper__topbar-btns">
        <button className="chart-wrapper__btn" onClick={handleDownload} title="Descargar" type="button" disabled={downloading} style={downloading ? { opacity: 0.5, cursor: "wait" } : undefined}>
          <Download size={14} />
        </button>
        <button className="chart-wrapper__btn" onClick={onAction} title={actionTitle} type="button">
          {actionIcon}
        </button>
      </div>
    </div>
  );

  const bodyContent = (
    <>
      {children}
      {downloadTableData && downloadTableData.length > 0 && (
        <table className="chart-download-table hidden">
          <thead>
            <tr>
              {Object.keys(downloadTableData[0]).map((k) => (
                <th key={k} style={{ textAlign: "left", padding: "3px 6px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", fontWeight: 600 }}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {downloadTableData.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
                {Object.values(row).map((v, j) => (
                  <td key={j} style={{ padding: "3px 6px", borderBottom: "1px solid #f3f4f6", textAlign: j === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                    {typeof v === "number" ? v.toFixed(1) : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );

  return (
    <>
      <div ref={containerRef} className={standalone ? "chart-wrapper panel" : "chart-wrapper"}>
        {topbar(openFS, <Maximize2 size={14} />, "Ver en pantalla completa")}
        {meta()}
        <div
          className="chart-wrapper__body"
          style={(fullscreen || closing) ? { pointerEvents: "none", overflow: "hidden" } : undefined}
        >
          {bodyContent}
        </div>
        {legendEl}
      </div>

      {(fullscreen || closing) && createPortal(
        <>
          <div className={`chart-fs-backdrop${closing ? " closing" : ""}`} onClick={closeFS} />
          <div className={`chart-fs-modal${closing ? " closing" : ""}`}>
            {topbar(closeFS, <X size={14} />, "Cerrar")}
            {meta(true)}
            <div className="chart-wrapper__body">
              {bodyContent}
            </div>
            {legendEl}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
