import { useMemo, useState } from "react";
import type { MunicipioAnalyticsRecord } from "../../types/analytics";
import InterpretationHelp from "./InterpretationHelp";

type SortKey = "nom_mun" | "pobtot_iter" | "pob_pct_4g_garantizada" | "graproes" | "pct_mujeres" | "pct_pob_65_mas";

type Props = {
  municipios: MunicipioAnalyticsRecord[];
};

export default function MunicipiosTable({ municipios }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("pob_pct_4g_garantizada");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...municipios];
    copy.sort((a, b) => {
      let va: string | number = 0;
      let vb: string | number = 0;
      if (sortKey === "nom_mun") {
        va = a.nom_mun;
        vb = b.nom_mun;
        return asc ? va.localeCompare(vb as string, "es") : (vb as string).localeCompare(va as string, "es");
      }
      va = (a[sortKey] as number) ?? 0;
      vb = (b[sortKey] as number) ?? 0;
      return asc ? va - vb : vb - va;
    });
    return copy;
  }, [municipios, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) {
      setAsc(!asc);
    } else {
      setSortKey(k);
      setAsc(k === "nom_mun");
    }
  };

  return (
    <div>
      <div className="section-heading">
        <h2>Municipios del estado</h2>
        <p>Haz clic en el encabezado para ordenar. Cobertura 4G: población en localidades con 4G garantizada (2024).</p>
      </div>
      <InterpretationHelp
        topic="Tabla de municipios del estado (cobertura, escolaridad, cluster)"
        caption="Ayuda: tabla"
        heading="Lectura de las columnas"
      >
        <p>
          Cada fila corresponde a un municipio del estado. Ordenando por cualquier columna se pueden detectar
          patrones (por ejemplo, contrastar población vs cobertura, o escolaridad vs estructura etaria).
        </p>
        <p>
          <strong>4G pob. %</strong> — porcentaje de la población que residiría en localidades con señal 4G
          verificada. Un valor del 30% indicaría que aproximadamente el 70% de la población del municipio vive
          en localidades sin cobertura registrada.
        </p>
        <p>
          <strong>Escolaridad</strong> — promedio de años escolares completados a nivel municipal. Como referencia:
          6.0 equivale a primaria completa, 9.0 a secundaria, 12.0 a preparatoria.
        </p>
        <p>
          <strong>Perfil</strong> — uno de tres grupos por estado (alta, media o baja cobertura 4G relativa),
          con k-medias sobre cobertura, escolaridad y edad. No implica vecindad geográfica.
        </p>
      </InterpretationHelp>
      <div className="ranking-table-scroll">
        <table className="ranking-table">
          <thead>
            <tr>
              {(
                [
                  ["nom_mun", "Municipio", true],
                  ["pobtot_iter", "Población", true],
                  ["pob_pct_4g_garantizada", "4G pob. %", true],
                  ["graproes", "Escolaridad", true],
                  ["pct_mujeres", "% mujeres", true],
                  ["pct_pob_65_mas", "% 65+", true],
                  ["cluster_label", "Cluster", false]
                ] as const
              ).map(([key, label, sortable]) => (
                <th
                  key={key}
                  style={{ cursor: sortable ? "pointer" : "default" }}
                  onClick={() => (sortable ? toggle(key as SortKey) : undefined)}
                >
                  {label}
                  {sortable && sortKey === key ? (asc ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.cvegeo}>
                <td style={{ fontWeight: 600 }}>{m.nom_mun}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {m.pobtot_iter.toLocaleString("es-MX")}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {m.pob_pct_4g_garantizada?.toFixed(1) ?? "—"}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {m.graproes?.toFixed(2) ?? "—"}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {m.pct_mujeres != null ? m.pct_mujeres.toFixed(1) : "—"}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {m.pct_pob_65_mas?.toFixed(1) ?? "—"}
                </td>
                <td>{m.cluster_label ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
