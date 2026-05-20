import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

type Props = { text: ReactNode; wide?: boolean };

export default function InfoTooltip({ text, wide }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, flipUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  function calcPos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popoverW = wide ? 320 : 240;
    const popoverH = wide ? 200 : 120;
    const gap = 8;

    let left = r.left + r.width / 2 - popoverW / 2;
    // clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - popoverW - 8));

    const spaceBelow = window.innerHeight - r.bottom;
    const flipUp = spaceBelow < popoverH + gap + 8;

    const top = flipUp ? r.top - gap - popoverH : r.bottom + gap;

    setPos({ top, left, flipUp });
  }

  function toggle() {
    if (!open) calcPos();
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll() { setOpen(false); }
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="info-tooltip-btn"
        onClick={toggle}
        aria-label="Más información"
      >
        <Info size={13} />
      </button>
      {open && createPortal(
        <div
          className={`info-tooltip-popover${wide ? " info-tooltip-popover--wide" : ""}`}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
