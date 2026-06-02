import type { ReactNode } from "react";

type Props = { children: ReactNode; noSidebar?: boolean };

export default function MainContent({ children, noSidebar }: Props) {
  return (
    <main className={`layout-main${noSidebar ? " no-sidebar" : ""}`}>
      {children}
      <footer className="app-footer">
        <span>© 2026 Tecnológico de Monterrey </span>
        <span className="app-footer__sep" aria-hidden>·</span>
        <span>Joana Barreto · Luis E. Morales · Yamilet Lozada · Andrea García</span>
      </footer>
    </main>
  );
}
