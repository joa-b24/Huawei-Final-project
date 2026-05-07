import type { ReactNode } from "react";

type Props = { id: string; activeTab: string; children: ReactNode };

export default function TabPanel({ id, activeTab, children }: Props) {
  if (id !== activeTab) return null;
  return (
    <section role="tabpanel" aria-labelledby={`tab-${id}`}>
      {children}
    </section>
  );
}
