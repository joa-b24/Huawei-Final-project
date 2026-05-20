#!/usr/bin/env python3
"""
Figuras didácticas (datos sintéticos) para slides: Lorenz/Gini, Spearman, K-medias.

Uso desde la raíz del repo:
  python3 scripts/generate_method_slide_figures.py

Salida: docs/slides_figuras/*.png
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "slides_figuras"

plt.rcParams.update(
    {
        "figure.dpi": 150,
        "font.size": 11,
        "axes.titlesize": 13,
        "axes.labelsize": 11,
    }
)


def fig_lorenz_gini() -> None:
    rng = np.random.default_rng(42)
    x = np.clip(rng.normal(55, 22, 80), 5, 100)
    w = rng.integers(500, 50000, size=80)
    order = np.argsort(x)
    x, w = x[order], w[order]
    W = np.cumsum(w)
    Xmass = np.cumsum(w * x)
    pop_share = W / W[-1]
    cov_share = Xmass / Xmass[-1]

    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot([0, 1], [0, 1], "k--", lw=1.5, label="Igualdad perfecta")
    ax.plot(pop_share, cov_share, color="#2563eb", lw=2.5, label="Curva de Lorenz (ejemplo)")
    verts = [(0, 0)] + list(zip(pop_share.tolist(), cov_share.tolist())) + [(1, 1)]
    ax.add_patch(Polygon(verts, closed=True, facecolor="#93c5fd", alpha=0.35, edgecolor="none"))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xlabel("Fracción acumulada de población (municipios ordenados)")
    ax.set_ylabel("Fracción acumulada de cobertura 4G (ponderada)")
    ax.set_title("Lorenz + idea visual del Gini (datos de ejemplo)")
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT / "01_lorenz_gini_ejemplo.png")
    plt.close(fig)


def fig_spearman_heatmap() -> None:
    labels = ["4G pob.", "Escolar.", "% 0–14", "% 15–64", "% 65+", "% mujeres"]
    R = np.array(
        [
            [1.00, 0.62, -0.35, 0.28, -0.18, 0.10],
            [0.62, 1.00, -0.50, 0.41, -0.05, 0.22],
            [-0.35, -0.50, 1.00, -0.60, -0.12, -0.08],
            [0.28, 0.41, -0.60, 1.00, -0.25, 0.05],
            [-0.18, -0.05, -0.12, -0.25, 1.00, 0.03],
            [0.10, 0.22, -0.08, 0.05, 0.03, 1.00],
        ]
    )
    fig, ax = plt.subplots(figsize=(6.2, 5.2))
    im = ax.imshow(R, vmin=-1, vmax=1, cmap="RdBu_r")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.set_yticklabels(labels)
    for i in range(R.shape[0]):
        for j in range(R.shape[1]):
            ax.text(j, i, f"{R[i, j]:.2f}", ha="center", va="center", color="black", fontsize=9)
    ax.set_title("Spearman (ejemplo): asociación monótona entre variables municipales")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="ρ (toy)")
    fig.tight_layout()
    fig.savefig(OUT / "02_spearman_heatmap_ejemplo.png")
    plt.close(fig)


def fig_kmeans_clusters() -> None:
    rng = np.random.default_rng(7)
    centers = np.array([[2.0, 8.0], [8.0, 3.0], [8.0, 9.0]])
    X = np.vstack([rng.normal(c, 1.1, (45, 2)) for c in centers])
    kmeans = KMeans(n_clusters=3, random_state=0, n_init=10)
    labels = kmeans.fit_predict(X)

    fig, ax = plt.subplots(figsize=(6, 5))
    colors = ["#ef4444", "#22c55e", "#3b82f6"]
    for k in range(3):
        ax.scatter(
            X[labels == k, 0],
            X[labels == k, 1],
            s=22,
            alpha=0.75,
            c=colors[k],
            label=f"Cluster {k}",
        )
    ax.scatter(
        kmeans.cluster_centers_[:, 0],
        kmeans.cluster_centers_[:, 1],
        c="black",
        s=120,
        marker="X",
        label="Centroides",
        zorder=5,
    )
    ax.set_xlabel("Variable 1 (ej. cobertura 4G estandarizada)")
    ax.set_ylabel("Variable 2 (ej. escolaridad estandarizada)")
    ax.set_title("K-medias (ejemplo): perfiles similares en el espacio de atributos")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT / "03_kmedias_clusters_ejemplo.png")
    plt.close(fig)


def fig_silhouette_vs_k() -> None:
    """k vs silueta (toy) para ilustrar la elección de k en el pipeline."""
    rng = np.random.default_rng(99)
    X = np.vstack([rng.normal(c, 1.0, (60, 2)) for c in [[2, 2], [7, 7], [7, 2]]])
    ks = list(range(2, 9))
    scores: list[float] = []
    for k in ks:
        km = KMeans(n_clusters=k, random_state=0, n_init=10)
        lab = km.fit_predict(X)
        scores.append(float(silhouette_score(X, lab)))

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(ks, scores, "o-", color="#7c3aed", lw=2, markersize=8)
    k_best = ks[int(np.argmax(scores))]
    ax.axvline(k_best, color="#94a3b8", ls="--", lw=1.5, label=f"k elegido (ejemplo): {k_best}")
    ax.set_xlabel("Número de clusters (k)")
    ax.set_ylabel("Coeficiente de silueta (toy)")
    ax.set_title("Silueta vs k (ejemplo): se retiene k con mayor silueta")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT / "04_silueta_vs_k_ejemplo.png")
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig_lorenz_gini()
    fig_spearman_heatmap()
    fig_kmeans_clusters()
    fig_silhouette_vs_k()
    print(f"Listo. PNG en: {OUT}")


if __name__ == "__main__":
    main()
