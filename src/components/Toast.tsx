import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; msg: string };
const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 2200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="j-card j-fade px-4 py-2 j-glow-text" style={{ fontFamily: "var(--font-uncial)" }}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
