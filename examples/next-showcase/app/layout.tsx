import type { ReactNode } from "react";

export const metadata = {
  title: "Ultra Chess React — showcase",
  description:
    "Comprehensive showcase of gigaboard: themes, piece sets, sounds, premoves, arrows, keyboard nav, and more.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0f1115",
          color: "#e6e8eb",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
