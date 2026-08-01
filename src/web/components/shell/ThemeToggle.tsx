import { Moon, Sun } from "@phosphor-icons/react";
import { useEffect } from "react";
import { IconButton } from "../primitives";
import { useHQStore } from "../../store/useHQStore";

/** Keeps `document.documentElement[data-theme]` in sync with the store's `theme`. */
export function ThemeToggle() {
  const theme = useHQStore((state) => state.theme);
  const setTheme = useHQStore((state) => state.setTheme);

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
