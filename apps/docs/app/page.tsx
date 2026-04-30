import { BoardDemo } from "./components/board-demo";

/**
 * Ultra Chess React — docs home page.
 *
 * Server component renders the layout; the interactive board is in a
 * client-only leaf (`BoardDemo`) so the rest of the page stays RSC.
 */
export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Ultra Chess React</h1>
      <p style={{ color: "#555", margin: "0 0 1.5rem 0" }}>
        Opinionated React chessboard with owned state, byte-scoped subscriptions, SSR static rendering,
        accessibility, and a measured &lt; 16 KB interactive surface.
      </p>
      <BoardDemo />
    </main>
  );
}
