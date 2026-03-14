# Map Interaction Specification & Developer Guide

## Critical Features (Non-Negotiable)

To prevent regressions, the following features in `src/components/ElectionMap.jsx` must be preserved during any refactoring or styling changes:

### 1. Reactive Popups (`openPopupRef`)
- **Behavior**: When a precinct is clicked, a popup opens. If the user moves the **Round Slider**, the content inside that open popup must update *immediately* to reflect the votes in the new round.
- **Implementation**: Uses `openPopupRef` to track the active layer and a `useEffect` hook that triggers on `activeRound` change to call `layer.setPopupContent()`.

### 2. Selection Highlighting (`selectedPrecinct`)
- **Behavior**: Clicking a precinct must change its border color to **Gold (#FFD700)** and increase its border weight.
- **Implementation**: Managed via `selectedPrecinct` state in `PrecinctLayer`. The `getStyle` function checks this state.
- **Clearing**: The highlight must reset when the popup is closed (use the `popupclose` event on the layer) or when a new precinct is clicked.

### 3. Removed Hover Highlights
- **Requirement**: As of March 2024, the map should **NOT** have hover highlights (no `mouseover` or `mouseout` logic that changes styles) to avoid visual clutter and click-event interference.
- **Constraint**: Do not add `bringToFront()` on hover, as this can break the click event flow.

## Why Regressions Happen
Previous regressions occurred because Interaction and Styling are handled within the same `onEachFeature` and `getStyle` blocks. When "cleaning up" hover effects, the "Selection" effect or "Reactive Popup" logic was accidentally deleted.

**Before editing `ElectionMap.jsx`, ensure you are not deleting the `openPopupRef` reactivity or the `selectedPrecinct` color logic.**
