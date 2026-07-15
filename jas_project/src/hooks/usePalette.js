import { useCallback, useState } from "react";
import "../lib/color_palette.js";

/**
 * Hook that loads and caches the user's color palette from Supabase.
 * Returns { palette, loading, refresh }.
 */
export function usePalette() {
  const [palette, setPalette] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchPalette();
    setPalette(data);
    setLoading(false);
  }, []);

  // Auto-fetch on first render
  const initialized = useCallback(() => {
    refresh();
  }, [refresh]);

  // Return a ref-like callback to trigger initial load
  return { palette, loading, refresh, init: initialized };
}
