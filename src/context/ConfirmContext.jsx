import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../components/Modal.jsx";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, resolve, danger }

  const confirm = useCallback((message, { danger = true } = {}) => {
    return new Promise((resolve) => {
      setState({ message, resolve, danger });
    });
  }, []);

  const handle = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => handle(false)} title="Please confirm">
        {state && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${state.danger ? "bg-rust/10 text-rust" : "bg-thread/10 text-thread"}`}>
                <AlertTriangle size={18} />
              </div>
              <p className="text-sm pt-1.5">{state.message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => handle(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${state.danger ? "bg-rust hover:opacity-90" : "bg-ink hover:bg-ink2"}`}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
