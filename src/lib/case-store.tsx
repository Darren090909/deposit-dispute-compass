import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SAMPLE_CASE, type Case } from "./case";

const KEY = "rentresolve-case-v1";

interface Store {
  current: Case | null;
  ready: boolean;
  setCase: (c: Case | null) => void;
  update: (patch: Partial<Case>) => void;
  loadSample: () => void;
}

const Ctx = createContext<Store | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Case | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCurrent(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const setCase = (c: Case | null) => {
    setCurrent(c);
    try {
      if (c) localStorage.setItem(KEY, JSON.stringify(c));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <Ctx.Provider
      value={{
        current,
        ready,
        setCase,
        update: (patch) => current && setCase({ ...current, ...patch }),
        loadSample: () => setCase(structuredClone(SAMPLE_CASE)),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCase() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCase must be used within CaseProvider");
  return c;
}
