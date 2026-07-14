import { useEffect, useState } from "react";

const STORAGE_KEY = "pdf-viewer-theme";

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefers =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefers;
    setIsDark(dark);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark, hydrated]);

  return { isDark, setIsDark, toggle: () => setIsDark((v) => !v) };
}
