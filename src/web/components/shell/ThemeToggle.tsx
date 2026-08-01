import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect } from "react";
import { IconButton } from "../primitives";
import { useCodeHQStore } from "../../store/useCodeHQStore";

/** Keeps `document.documentElement[data-theme]` in sync with the store's `theme`. */
export function ThemeToggle() {
  const theme = useCodeHQStore((state) => state.theme);
  const setTheme = useCodeHQStore((state) => state.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <IconButton
      label={`Switch to ${nextTheme} theme`}
      icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      onClick={() => setTheme(nextTheme)}
    />
  );
}
