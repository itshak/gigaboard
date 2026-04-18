import { MinimalBoard } from "./minimal-board";

/** Smallest Next.js integration: a single interactive board on the page. */
export default function Page() {
  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Ultra Chess React — minimal example</h1>
      <MinimalBoard />
    </main>
  );
}
