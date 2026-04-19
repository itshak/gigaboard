import type { ReactNode } from "react";

export const metadata = { title: "Ultra Chess React — analysis example" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0e14" }}>{children}</body>
    </html>
  );
}
