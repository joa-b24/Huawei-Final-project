import type { ReactNode } from "react";

type Props = { children: ReactNode };

export default function MainContent({ children }: Props) {
  return <main className="layout-main">{children}</main>;
}
