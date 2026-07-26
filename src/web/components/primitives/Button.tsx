import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label; purely decorative, so it is hidden from assistive tech. */
  icon?: ReactNode;
  children: ReactNode;
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", icon, children, type, ...rest } = props;
  return (
    <button type={type ?? "button"} {...rest} className={`${styles.button} ${styles[variant]} ${styles[size]}`}>
      {icon !== undefined ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
