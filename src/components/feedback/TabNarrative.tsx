import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
  style?: CSSProperties;
};

export default function TabNarrative({ title, description, children, style }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="tab-narrative" style={style}>
      <button
        type="button"
        className="tab-narrative__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tab-narrative__label">{title}</span>
        <span className="tab-narrative__desc">{description}</span>
        <span className="tab-narrative__chevron">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>
      {open && children ? <div className="tab-narrative__body">{children}</div> : null}
    </div>
  );
}
