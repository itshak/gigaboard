# GigaBoard — Status

**Updated:** 2026-11-08. **Published npm version:** 1.7.1.

- Completed/archived: [mac-feel-responsive-pipeline](../openspec/changes/archive/2026-11-08-mac-feel-responsive-pipeline/archive-notes.md). CI lint, typecheck, tests, bundle size, browser integrity, macOS-hosted WebKit and npm registry verification passed.
- The optional dragGeometryCache defaults false and minimizes pointer geometry reads when opted in. The 4px threshold remains the package default; consumers choose their own 2px mouse policy.
- Active: [automated-board-feel-lab](../openspec/changes/automated-board-feel-lab/tasks.md) still lacks full native macOS WKWebView measurement and device-level acceptance.
- Not tested: native macOS BlindBase subjective responsiveness and iOS hardware; browser/WebKit results are not a physical input-to-photon measurement.
