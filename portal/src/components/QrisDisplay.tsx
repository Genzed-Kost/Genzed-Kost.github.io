import { useEffect, useRef } from "react";

export function QrisDisplay({ payload }: { payload: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || typeof QRCode === "undefined") return;
    ref.current.innerHTML = "";
    new QRCode(ref.current, {
      text: payload,
      width: 220,
      height: 220,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }, [payload]);

  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        padding: 12,
        borderRadius: 14,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}
