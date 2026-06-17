import type { ReactNode } from "react";

/** Grayscale logo for print document headers */
export function PrintLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      style={{
        height: "40px",
        width: "auto",
        filter: "grayscale(100%)",
        marginRight: "8px",
      }}
      alt="Logo"
    />
  );
}

export function PrintCompanyHeader({
  children,
  className = "header-title",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PrintLogo />
      <span>{children}</span>
    </div>
  );
}
