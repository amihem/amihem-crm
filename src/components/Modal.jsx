import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, title, children, wide }) {
  const contentRef = useRef(null);

  // Escape closes the modal, and the first focusable field inside gets
  // focus automatically — without this every modal open needs a mouse
  // click before you can start typing, which adds up over a full day of
  // data entry.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);

    const focusTimer = setTimeout(() => {
      const field = contentRef.current?.querySelector(
        "input:not([type=hidden]):not([disabled]), textarea, select"
      );
      field?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKey);
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={contentRef}
        className={`bg-panel rounded-t-2xl sm:rounded-2xl w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto shadow-xl animate-[modalIn_0.18s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-panel z-10">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink w-8 h-8 flex items-center justify-center rounded-full hover:bg-paper"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
