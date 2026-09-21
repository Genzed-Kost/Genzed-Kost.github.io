import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Kedaluwarsa";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  return `${m}m ${s}d`;
}

export function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= target) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const remaining = new Date(expiresAt).getTime() - now;

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: remaining < 5 * 60 * 1000 ? "var(--danger)" : "var(--text)" }}>
      {formatRemaining(remaining)}
    </span>
  );
}
