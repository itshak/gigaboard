import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Ultra Chess React — docs",
    template: "%s · Ultra Chess React",
  },
  description:
    "Opinionated React chessboard with owned state, byte-scoped subscriptions, SSR static rendering, accessibility, and a measured < 16 KB interactive surface.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
