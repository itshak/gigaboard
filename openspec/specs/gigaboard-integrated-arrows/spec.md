## Purpose

Defines the architecture, rendering engine, and visual geometry for Gigaboard's integrated 3D arrows layer, including Aero-Chisel heads with flight-aligned evaluation labels, sculpted Aero-Sharp non-eval pointers, Russian Г-shape knight collision routing, WebKit/Safari SVG filter bounds, and cross-runtime environment safety.

## Requirements

### Requirement: Integrated Aero-Chisel Arrowhead with Flight-Aligned Evaluation

Gigaboard arrows carrying `label` with `background` and `headStyle: "aero_chisel"` SHALL render an integrated aerodynamic arrowhead with dynamic auto-centering text cabin, 60° beveled nose closure, and concave dock joint connecting to the cylindrical shaft. The arrowhead and text SHALL rotate with the flight angle and flip 180° when left-facing (angles between 90° and 270°).

#### Scenario: Aero-Chisel evaluation pointer renders
- **WHEN** an arrow carries `label: { text: "+0.3", fill: "#000000", background: "#F59E0B", headStyle: "aero_chisel" }`
- **THEN** the overlay draws an integrated Aero-Chisel arrowhead rotated along the flight vector, with `+0.3` centered inside and high AAA contrast.

#### Scenario: Automatic upright text flip
- **WHEN** an arrow points leftward (angle between 90° and 270°)
- **THEN** the text rotates 180° so the numeral remains right-side up for natural reading orientation.

### Requirement: Sculpted Aero-Sharp Pointer for Non-Evaluation Arrows

When an arrow has empty or absent label text (`!label.text || label.text.trim() === ""`), Gigaboard SHALL render a compact 4.6u sculpted Aero-Sharp chisel pointer sharing identical material, gradient, dock joint, and drop-shadow styling, leaving $+3.7\text{u}$ extra shaft clearance on short/1-square moves without rendering an empty text cabin.

#### Scenario: 1-square move with non-eval arrow
- **WHEN** an arrow moves 1 square (e.g. `d2-d3`) without evaluation text
- **THEN** it renders with the 4.6u Aero-Sharp pointer and an unclipped, clearly visible 3D shaft.

### Requirement: Russian Г-Shape Knight Collision Routing

Knight moves SHALL dynamically select their 90° corner bend (rank-first vs file-first) to avoid overlapping collinear arrow shafts sharing the same origin file or rank.

#### Scenario: Collinear file evasion
- **WHEN** a pawn on g7 pushes to g6 while a knight on g8 jumps to f6
- **THEN** the knight route bends along the rank first (stepping off the g-file immediately) to prevent shaft overlap.

### Requirement: WebKit SVG Filter Reliability via Explicit Coordinates

SVG filters for arrow shadows and Apple elevation SHALL declare `filterUnits="userSpaceOnUse"` with explicit coordinate bounds `[-20, -20, 140, 140]` so straight vertical lines ($\Delta x = 0$) do not collapse the filter bounding box in WebKit/Safari.

#### Scenario: Vertical pawn push shaft visibility
- **WHEN** a 2-square vertical pawn push (e.g. `d2-d4`, `e2-e4`) is displayed
- **THEN** the shaft and head render with full Apple elevation drop shadow without disappearing or flickering in Safari or Tauri webviews.

### Requirement: Cross-Runtime Environment Safety

Gigaboard core models SHALL guard all accesses to Node.js `process` globals (e.g. `process.env.NODE_ENV`) with `typeof process !== "undefined"` to guarantee safe execution in WebKit, Safari, and isolated webview environments.

#### Scenario: Running inside browser without Node process global
- **WHEN** Gigaboard board model initializes in Safari, Mobile Safari, or Tauri webview where `process` is not defined
- **THEN** no `ReferenceError: Can't find variable: process` is thrown.
