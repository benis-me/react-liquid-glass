import { useCallback, useState } from "react";
import { useGlassBackend } from "./provider";
import type { GlassRendererBackend } from "./renderer";

/** A failure applies to one selection; an explicit selection change retries it. */
export function useRendererBackend(override?: GlassRendererBackend) {
  const inherited = useGlassBackend();
  const requested = override ?? inherited;
  const [state, setState] = useState<{ requested: GlassRendererBackend; error?: Error }>({ requested });
  if (state.requested !== requested) setState({ requested });
  const fallback = state.requested === requested ? state.error : undefined;
  const onFallback = useCallback((error: Error) => setState({ requested, error }), [requested]);
  return { requested, backend: fallback ? "webgl2" as const : requested, fallback, onFallback };
}
