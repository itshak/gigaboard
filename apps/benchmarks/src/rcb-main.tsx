import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RcbApp } from "./rcb-app.js";

const container = document.getElementById("root");
if (!container) throw new Error("Benchmarks (rcb): #root element missing");
createRoot(container).render(
  <StrictMode>
    <RcbApp />
  </StrictMode>,
);
