# Technical Specification

## 1) Goal and Concept
An interactive canvas for building a graph of thoughts.
- **Node** = a textual thought (from one word to several sentences).
- **Edge** = a directed relationship (arrow/arc), optionally with text.
- Priorities: **clarity**, **minimal visual noise**, **fast physical layout adaptation**, **full touchpad control**, **natural and native feel**.

The application runs in a **React shell**, with D3.js responsible for rendering and low-level interactions.

---

## 2) Core Entities and States

### 2.1 Node
**Data fields**:
- `id` (string / uuid)
- `text` (string, multiline)
- `x`, `y` (coordinates)
- `w`, `h` (size)
- `state` (enum)
- optional: `createdAt`, `updatedAt`, `meta`

### Node States
There are **four** distinct visual/interaction states:

1) **Inactive**
- Compact representation.
- Text is truncated.
- Width ≈ text length of ~6 words.
- Height limited to ~3 lines.
- On hover: vertical scroll enabled if text overflows.

2) **Active (Selected)**
- Highlighted visually.
- Not editable.
- All connected edges are visible, including their labels.

3) **Editable**
- Text input is active inside the node.
- `Shift + Enter` inserts a newline.
- `Enter` exits editing → transitions to **Active**.
- While editable and after exit, node size **automatically adjusts to content**.

4) **Multi-selected (Visual selection)**
- Used for rectangular selection.
- Nodes are visually highlighted only.
- Does **not** imply Active or Editable state.

**Size rules**:
- Node size never exceeds content.
- In Active/Editable states, long text is fully shown by resizing the node.

---

### 2.2 Edge
**Data fields**:
- `id`
- `sourceId`, `targetId`
- `label` (string, optional)
- `routing` (control points / path data)
- `style` (optional)

**Visual form**:
- Smooth curved path (never straight).
- Multiple bends allowed if required by routing.
- Arrowhead at the end (small, subtle).
- Edge thickness is thin by default; slightly thicker when selected.

**Attachment rules**:
- Edge starts/ends at the node boundary.
- A small visual gap from the node is allowed, as long as the attachment is visually unambiguous.

---

## 3) Layout and Spatial Rules

### 3.1 General Layout Principles
- Edges must not intersect nodes.
- Edge–edge intersections should be minimized.
- Edges strive to be as short and straight as possible while remaining smooth.
- **Connected nodes are always positioned closer to each other than unconnected ones**.
- Unconnected nodes do not drift too far away, but are spaced enough to avoid overlap.

### 3.2 Collision and Push Behavior
- During **drag** and after release:
  - If a node is pushed onto another node, the other node **smoothly moves away**.
  - This push behavior is continuous and physical, not discrete.

### 3.3 Focus and Context
When a node becomes Active:
- The view/layout adapts to bring **as many directly connected nodes as possible** into view.
- Distant or unrelated nodes may move farther away.
- Connected nodes outside the viewport are gently pulled closer.

### 3.4 Animation and Physicality
- All movements use smooth animations with physical easing (fast start → slow end).
- After any structural change (move, create, delete, text change):
  - A layout adaptation starts within **1–2 seconds**.
  - Duration and strength are parameterized.
- Animations never block text input.

---

## 4) Interaction Model

### 4.1 Canvas Navigation
- **Two-finger pan**: move the canvas (no click required).
- **Two-finger pinch**: zoom.
- Mouse wheel zoom and mouse-drag pan are optional/configurable.

### 4.2 Node Creation
- **Click on empty space** → create a new node at that position.
- **Enter with no selection** → create a new node in a convenient position and enter Editable mode.

### 4.3 Rectangular Selection
- **Drag on empty space** → draw a rectangular selection.
- Nodes inside the rectangle enter **Multi-selected** state.
- Dragging empty space no longer creates nodes.

### 4.4 Selection and Editing
- **Click node** → Active.
- **Click Active node again** or **double-click** → Editable.
- `Enter` in Active → switch to Editable.
- `Escape` exits Editable → Active.

### 4.5 Dragging Nodes
- Dragging a non-editable node moves it with slight inertia.
- During drag, collisions cause other nodes to move away smoothly.
- After release, layout adaptation is triggered.

### 4.6 Edge Creation
- From an **Active node**, mouse drag starts edge creation outward.
- Drag preview follows the cursor.
- Release on another node → edge is created.
- Release on empty space → new node is created and connected.
- Edge direction is always **outward from the source node**.

### 4.7 Keyboard Navigation Between Nodes
- **Ctrl/Cmd + Arrow keys** → create a new node and edge in that direction.
- **Arrow keys on Active node** → move selection to a connected node in that direction, if one exists.
- Direction is inferred from current layout (approximate sectors, not strict axes).

### 4.8 Edge Visibility and Editing
- When a node is Active:
  - All connected edges and their labels are visible.
- Without an Active node:
  - Edge labels are hidden.
  - Replaced by a small, elegant widget (e.g. ellipsis in a frame) positioned automatically along the edge.

- Hovering an edge shows affordances for selection/editing.
- Selected edge displays its label.
- `Enter` / `Escape` exits edge editing or deselects.

### 4.9 Deletion
- `Delete` / `Backspace`:
  - Deletes selected node(s) and their connected edges.
  - If an edge is selected, deletes only that edge.

---

## 5) UI Controls (Overlay)
Position: bottom-left, floating above the canvas.

Buttons:
- **Clear graph** (remove all nodes and edges).
- **Fit View** (fit entire graph into viewport).
- **Export / Import JSON**:
  - File-based export/import.
  - Copy/paste JSON via clipboard.
  - Option to include current layout data.
- **Help**:
  - Clean, well-designed panel describing all interactions and shortcuts.

---

## 6) Undo / Redo
- Undo/redo system with fixed capacity (parameterized).
- Default depth: **20 actions**.
- Tracks **graph actions only** (create, delete, move, connect, edit text).
- Text input keystrokes are not individual undo steps.
- Undo/redo actions are represented with UI icons.

---

## 7) Code Style and Architecture
- Codebase must be **modular**, **readable**, and **easy to extend**.
- Architecture must be **clean and intentional** (clear responsibilities, minimal coupling).
- Decomposition must be planned across:
  - components/modules
  - classes/objects
  - files and folder structure
- Prefer small, composable units over monoliths.
- Provide short English comments only where they add clarity (non-obvious logic, edge cases, layout/routing decisions).
- Separate concerns explicitly:
  - rendering (D3/SVG/canvas)
  - interaction/state machine (selection/edit/drag)
  - layout and routing (constraints, collision, edge paths)
  - persistence/import/export
  - UI overlay (controls, help, toasts)

## 8) Scaling and Visual Rules
- Typical graph size: **5–100 nodes**.
- Maximum supported: ~**500 nodes** and comparable number of edges.
- Not all nodes must fit on screen simultaneously.

Zoom behavior:
- Fonts stay constant in size.
- At extreme zoom-out, font size may reduce slightly to increase information density.
- Edges remain thin; selected edges slightly thicker.

---

## 8) Persistence and State
- Application state is saved after every meaningful action.
- On page reload, the graph state is restored automatically.
- State can be fully cleared via explicit user action.

---

## 9) Notifications and Errors
- Errors, warnings, and info messages are shown as **non-modal toast notifications**.
- Toasts include a close button.
- Maximum visible toasts: **3**; overflow becomes scrollable.
- Categories:
  - Info (e.g. node created, undo applied, import successful)
  - Warning
  - Error
- Errors during import are handled gracefully; invalid data is discarded.

---

## 10) Visual Feedback and Affordances
- All possible actions are visually discoverable:
  - Hover states
  - Drag previews
  - Edge-creation targets
  - Selection highlights
- Visual language is consistent, subtle, and native-feeling.
- Interactions feel continuous and predictable.

---

## 11) Design Philosophy for Undefined Cases
If an interaction or edge case is not explicitly described in this specification:
- Resolve it in the **most elegant, minimal, and intuitive way**.
- Prefer visual clarity and spatial stability over strict rules.
- Avoid surprising layout jumps or destructive actions.

