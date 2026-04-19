import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CgApp } from "./cg-app.js";
import { CgGridApp } from "./grid-cg.js";

const container = document.getElementById("root");
if (!container) throw new Error("Benchmarks (cg): #root element missing");

const gridN = Number(new URLSearchParams(window.location.search).get("grid") ?? 0);
const root = gridN > 0 ? <CgGridApp n={gridN} /> : <CgApp />;

createRoot(container).render(<StrictMode>{root}</StrictMode>);
