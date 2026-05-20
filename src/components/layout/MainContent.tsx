import type { ReactNode } from "react";

type Props = { children: ReactNode };

export default function MainContent({ children }: Props) {
  return (
    <main className="layout-main">
      {children}
      <footer className="app-footer">
        <span>© 2026 Tecnológico de Monterrey </span>
        <span className="app-footer__sep" aria-hidden>·</span>
        <span>Luis E. Morales · Joana Barreto · Yamilet Lozada · Andrea García</span>
      </footer>
    </main>
  );
}
