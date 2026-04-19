"use client";

import type { LegalTargetStyle, Orientation } from "@ultrachess/react";
import type { PieceSetName, ShowcaseConfig, ThemeName } from "./showcase";
import { PIECE_SETS, THEMES } from "./showcase";

interface Props {
  readonly config: ShowcaseConfig;
  readonly onChange: (next: ShowcaseConfig) => void;
}

export function Controls({ config, onChange }: Props) {
  const patch = <K extends keyof ShowcaseConfig>(key: K, value: ShowcaseConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div style={panelStyle}>
      <h3 style={panelTitleStyle}>Appearance</h3>

      <Row label="Theme">
        <Select
          value={config.themeName}
          options={Object.keys(THEMES) as ThemeName[]}
          onChange={(v) => patch("themeName", v as ThemeName)}
        />
      </Row>

      <Row label="Piece set">
        <Select
          value={config.pieceSetName}
          options={Object.keys(PIECE_SETS) as PieceSetName[]}
          onChange={(v) => patch("pieceSetName", v as PieceSetName)}
        />
      </Row>

      <Row label="Orientation">
        <Select<Orientation>
          value={config.orientation}
          options={["white", "black"]}
          onChange={(v) => patch("orientation", v)}
        />
      </Row>

      <Row label="Legal targets">
        <Select<string>
          value={String(config.legalTargets)}
          options={["rings", "dots", "false"]}
          onChange={(v) => {
            const next: LegalTargetStyle = v === "false" ? false : (v as "rings" | "dots");
            patch("legalTargets", next);
          }}
        />
      </Row>

      <Checkbox
        label="Show coordinates"
        checked={config.showCoordinates}
        onChange={(v) => patch("showCoordinates", v)}
      />
      <Checkbox
        label="Highlight last move"
        checked={config.highlightLastMove}
        onChange={(v) => patch("highlightLastMove", v)}
      />
      <Checkbox
        label="Check highlight"
        checked={config.showCheckHighlight}
        onChange={(v) => patch("showCheckHighlight", v)}
      />
      <Checkbox
        label="Flash on illegal move"
        checked={config.showIllegalFlash}
        onChange={(v) => patch("showIllegalFlash", v)}
      />

      <h3 style={panelTitleStyle}>Interaction</h3>
      <Checkbox
        label="Drag & drop"
        checked={config.allowDrag}
        onChange={(v) => patch("allowDrag", v)}
      />
      <Checkbox
        label="Right-click arrows"
        checked={config.allowDrawingArrows}
        onChange={(v) => patch("allowDrawingArrows", v)}
      />
      <Checkbox
        label="Premoves"
        checked={config.allowPremove}
        onChange={(v) => patch("allowPremove", v)}
      />

      <h3 style={panelTitleStyle}>Animation</h3>
      <Checkbox
        label="Enabled"
        checked={config.animationEnabled}
        onChange={(v) => patch("animationEnabled", v)}
      />
      <Row label={`Duration: ${config.animationDurationMs}ms`}>
        <input
          type="range"
          min={0}
          max={600}
          step={20}
          value={config.animationDurationMs}
          onChange={(e) => patch("animationDurationMs", Number(e.target.value))}
          disabled={!config.animationEnabled}
          style={{ width: "100%" }}
        />
      </Row>

      <h3 style={panelTitleStyle}>Sound</h3>
      <Checkbox
        label="Enabled"
        checked={config.soundEnabled}
        onChange={(v) => patch("soundEnabled", v)}
      />
      <Row label={`Volume: ${Math.round(config.soundVolume * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.soundVolume}
          onChange={(e) => patch("soundVolume", Number(e.target.value))}
          disabled={!config.soundEnabled}
          style={{ width: "100%" }}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  // Rendered as a div (not <label>) since the visible text is informational
  // rather than tied to a specific input — the wrapped controls (<select>,
  // <input type="range">) are fully self-describing on their own.
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem 0",
        fontSize: "0.85rem",
        color: "#cfd3da",
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  readonly value: T;
  readonly options: readonly T[];
  readonly onChange: (v: T) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} style={selectStyle}>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

const panelStyle = {
  background: "#151821",
  border: "1px solid #232836",
  borderRadius: "8px",
  padding: "0.85rem 1rem",
  display: "grid",
  gap: "0.4rem",
} as const;

const panelTitleStyle = {
  margin: "0.6rem 0 0.25rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#8a92a3",
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.15rem 0",
} as const;

const rowLabelStyle = {
  fontSize: "0.8rem",
  color: "#9aa0a6",
};

const selectStyle = {
  background: "#0b0e14",
  color: "#cfd3da",
  border: "1px solid #2a2f3a",
  borderRadius: "5px",
  padding: "0.3rem 0.4rem",
  fontSize: "0.85rem",
  width: "100%",
} as const;
