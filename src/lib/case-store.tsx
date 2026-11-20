import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Case } from "./case";
import { deleteCaseEvidence } from "./evidence-store";

const KEY = "rentresolve-case-v1";

interface Store {
  current: Case | null;
  ready: boolean;
  storageError: string;
  setCase: (c: Case | null) => void;
  update: (patch: Partial<Case>) => void;
}

const Ctx = createContext<Store | null>(null);

export function restoreCase(raw: string): Case | null {
  const saved: Case = JSON.parse(raw);
  return saved?.isSample ? null : { ...saved, caseId: saved.caseId ?? crypto.randomUUID() };
}

export function CaseProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Case | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = restoreCase(raw);
        setCurrent(saved);
        if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
        if (!saved) localStorage.removeItem(KEY);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const setCase = (c: Case | null) => {
    if (current?.caseId && current.caseId !== c?.caseId) {
      void deleteCaseEvidence(current.caseId).catch(() => setStorageError("Old evidence could not be deleted from this device. Clear this site's browser storage to remove it."));
    }
    setCurrent(c);
    try {
      if (c) localStorage.setItem(KEY, JSON.stringify(c));
      else localStorage.removeItem(KEY);
    } catch {
      setStorageError("This browser could not save case details. Keep this page open or download your reviewed results.");
    }
  };

  return (
    <Ctx.Provider
      value={{
        current,
        ready,
        storageError,
        setCase,
        update: (patch) => current && setCase({ ...current, ...patch }),
      }}
    >
      {storageError && <p role="alert" className="mx-auto max-w-3xl px-4 py-3 text-sm text-destructive">{storageError}</p>}
      {children}
    </Ctx.Provider>
  );
}

export function useCase() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCase must be used within CaseProvider");
  return c;
}
