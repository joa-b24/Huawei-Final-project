import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

export default function TabNarrative({ title, description, children }: Props) {
  return (
    <>
      <p className="tab-section-label">{title}</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.65, color: "var(--text-2)" }}>
        {description}
      </p>
      {children}
    </>
  );
}
