import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Ultra Chess React — docs",
    template: "%s · Ultra Chess React",
  },
  description:
    "High-performance React chessboard: ≤ 1 React commit per move, 0 re-renders per drag frame, < 16 KB gzip. Powered by the ultrachess WASM engine — 55–95× faster than chess.js.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
