import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CgApp } from "./cg-app.js";

const container = document.getElementById("root");
if (!container) throw new Error("Benchmarks (cg): #root element missing");
createRoot(container).render(
  <StrictMode>
    <CgApp />
  </StrictMode>,
);
