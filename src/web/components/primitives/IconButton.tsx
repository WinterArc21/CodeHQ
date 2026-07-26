import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "aria-label">;

export interface IconButtonProps extends NativeButtonProps {
  /** Required: an icon-only control has no visible text, so this becomes its accessible name. */
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
}

export function IconButton(props: IconButtonProps) {
  const { label, icon, size = "md", type, ...rest } = props;
  return (
    <button type={type ?? "button"} {...rest} aria-label={label} className={`${styles.iconButton} ${styles[size]}`}>
      {icon}
    </button>
  );
}
