import { useEffect, useRef } from "react";

/**
 * Matrix / Limitless style background: green letters + digits falling.
 * Canvas-based, throttled, and pointer-events-none so it sits behind the UI.
 */
export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars =
      "アイウエオカキクケコサシスセソタチツテトﾊﾋﾌﾍﾎ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const fontSize = 16;
    let w = 0;
    let h = 0;
    let drops: number[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const columns = Math.ceil(w / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -60);
      ctx.fillStyle = "#0a0b0c";
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 55) return; // ~18fps — subtle and light
      last = t;

      // fade the previous frame toward the background for the trailing effect
      ctx.fillStyle = "rgba(10, 11, 12, 0.11)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px ui-monospace, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // bright head, occasionally near-white for sparkle
        ctx.fillStyle = Math.random() > 0.985 ? "rgba(210,255,230,0.95)" : "rgba(34,224,107,0.85)";
        ctx.fillText(ch, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-45" />;
}
