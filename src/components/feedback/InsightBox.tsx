import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
};

export default function InsightBox({ title, children }: Props) {
  return (
    <aside className="insight-box" role="note">
      {title && <p className="insight-box__title">{title}</p>}
      <div className="insight-box__body">{children}</div>
    </aside>
  );
}
