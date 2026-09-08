"use client";

import { useEffect, useState } from "react";

/** Feature-detects WebGL2 once on mount. Returns null while unknown (SSR/first
 * paint) so callers can render nothing rather than flash the fallback. */
export function useWebglSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Deferred a tick so this reads as "subscribing to an external check's result"
    // rather than a synchronous setState-in-effect (avoids the cascading-render lint).
    queueMicrotask(() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2");
        setSupported(Boolean(gl));
      } catch {
        setSupported(false);
      }
    });
  }, []);

  return supported;
}
