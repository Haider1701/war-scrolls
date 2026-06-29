import { useMemo } from "react";

export function Embers({ count = 22 }: { count?: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 14,
        dur: 9 + Math.random() * 10,
        size: 2 + Math.random() * 4,
        opacity: 0.4 + Math.random() * 0.5,
        key: i,
      })),
    [count],
  );
  return (
    <>
      {seeds.map((s) => (
        <span
          key={s.key}
          className="ember"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            opacity: s.opacity,
          }}
        />
      ))}
    </>
  );
}
