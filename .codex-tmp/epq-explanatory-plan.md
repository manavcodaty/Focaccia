# Focaccia Explanatory Diagrams Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans; preserve unrelated changes. No application code, commits or physical-demo tests.

**Goal:** Make the approved 17-slide EPQ story understandable from its diagrams, with concrete actions and clear consequences.

**Architecture:** Reuse the existing Excalidraw generator, editable browser canvas, geometric preflight, SVG export and artifact-tool PowerPoint pipeline. Create a separate `output/epq-story-explained/` version; preserve previous artefacts.

**Tech Stack:** Official Excalidraw, Yab browser, Node, artifact-tool, native Microsoft PowerPoint.

### Task 1: Preserve and clarify
- [x] Copy only the existing private build helpers into `.codex-tmp/epq-story-explained/`, redirect paths and keep the narration/evidence intact.
- [x] Replace abstract boxes with explicit examples: faces and protected records, sealed passes, lost confirmations, offline updates and evidence boundaries. Retain the effective scope ladder and feasibility triangle.
- [x] Align stage directions with the revised diagrams. Keep 17 slides and 1,250–1,400 spoken words.

### Task 2: Inspect editable source
- [x] Run the font-aware scene build and preflight. Fix every unintended intersection and padding failure.
- [x] Inspect all 17 full-frame browser canvases and any dense regions; save the editable master through Excalidraw.
- [x] Re-run preflight on the browser-saved master, then export SVGs and preserve fonts as outlines in PowerPoint copies only.

### Task 3: Verify final presentation
- [x] Assemble all 17 SVG slides with native notes and sources using the existing artifact-tool helper.
- [x] Open the new deck in Microsoft PowerPoint, verify 17 notes, advance all 17 slideshow positions and export native PDF.
- [x] Render and inspect every slide individually; compare native output to SVG and review montage.
- [x] Deliver the separate Excalidraw, PowerPoint and preview. State that no physical demo or audience study occurred.

## Scope and risks
Each slide must reveal its actor, action and consequence without narration. Check all frame edges, SVG viewBox, PowerPoint bounds and native PDF. Compare original file hashes after completion and reopen the saved deliverables.
No invented measured results, new research claims or completed trials. Encryption and signing remain distinct; face detection is not validated spoof resistance. All graphics are editable in Excalidraw, not separate PowerPoint shapes. A geometric pass supplements but does not replace visual inspection; human comprehension remains untested.
