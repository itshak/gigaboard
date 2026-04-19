import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RcbApp } from "./rcb-app.js";
import { RcbGridApp } from "./grid-rcb.js";

const container = document.getElementById("root");
if (!container) throw new Error("Benchmarks (rcb): #root element missing");

const gridN = Number(new URLSearchParams(window.location.search).get("grid") ?? 0);
const root = gridN > 0 ? <RcbGridApp n={gridN} /> : <RcbApp />;

createRoot(container).render(<StrictMode>{root}</StrictMode>);
