import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { GridApp } from "./grid-ours.js";

const container = document.getElementById("root");
if (!container) throw new Error("Benchmarks: #root element missing");

// `?grid=N` switches the page into grid-mount mode. Anything else (no
// search param, or `?grid=0`) renders the single-board scenario App.
const gridN = Number(new URLSearchParams(window.location.search).get("grid") ?? 0);
const root = gridN > 0 ? <GridApp n={gridN} /> : <App />;

createRoot(container).render(<StrictMode>{root}</StrictMode>);
