import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Ultra Chess React — docs",
    template: "%s · Ultra Chess React",
  },
  description:
    "The fastest React chessboard on the planet. Powered by ultrachess (WASM) — 55–95× faster than chess.js.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
