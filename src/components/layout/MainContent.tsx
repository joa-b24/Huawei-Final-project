import type { ReactNode } from "react";

type Props = { children: ReactNode; noSidebar?: boolean };

export default function MainContent({ children, noSidebar = false }: Props) {
  return (
    <main className="layout-main" style={noSidebar ? { marginLeft: 0 } : undefined}>
      {children}
      <footer className="app-footer">
        <span>© 2026 Tecnológico de Monterrey </span>
        <span className="app-footer__sep" aria-hidden>·</span>
        <span>Luis E. Morales · Joana Barreto · Yamilet Lozada · Andrea García</span>
      </footer>
    </main>
  );
}
