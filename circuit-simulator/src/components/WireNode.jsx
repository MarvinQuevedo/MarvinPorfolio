import React, { useRef, useCallback } from 'react';

const GRID = 10;
const snap = v => Math.round(v / GRID) * GRID;

/** Convert client (screen) coordinates to world (canvas) coordinates.
 *  Must be called with the element that received the pointer event,
 *  because its getCTM() already includes the canvas pan+zoom group transform. */
function clientToWorld(clientX, clientY, inverseCTM, svgEl) {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(inverseCTM);
}

export default function WireNode({
  wire,
  components,
  isSelected,
  onSelect,
  simulationCurrent,
  isSimulating,
  dispatch,
  zoom = 1,
}) {
  // dragRef: { wpIndex: number, svgEl: SVGSVGElement } | null
  const dragRef = useRef(null);

  // ─── helpers ───────────────────────────────────────────────────────────────
  const getPinCoords = (pinId) => {
    for (const comp of components) {
      const pin = comp.pins.find(p => p.id === pinId);
      if (pin) {
        const rad = comp.rotation * Math.PI / 180;
        return {
          x: comp.x + pin.offsetX * Math.cos(rad) - pin.offsetY * Math.sin(rad),
          y: comp.y + pin.offsetX * Math.sin(rad) + pin.offsetY * Math.cos(rad),
        };
      }
    }
    return null;
  };

  const startCoords = getPinCoords(wire.startPinId);
  const endCoords   = getPinCoords(wire.endPinId);
  if (!startCoords || !endCoords) return null;

  const waypoints = wire.waypoints || [];

  // Full point list: start → waypoints → end
  const allPoints = [startCoords, ...waypoints, endCoords];

  // ─── path building ─────────────────────────────────────────────────────────
  const buildPath = (pts) => {
    if (pts.length === 2 && waypoints.length === 0) {
      // Auto orthogonal only when no custom waypoints
      const [s, e] = pts;
      if (Math.abs(e.x - s.x) > Math.abs(e.y - s.y)) {
        const mx = (s.x + e.x) / 2;
        return `M ${s.x} ${s.y} L ${mx} ${s.y} L ${mx} ${e.y} L ${e.x} ${e.y}`;
      } else {
        const my = (s.y + e.y) / 2;
        return `M ${s.x} ${s.y} L ${s.x} ${my} L ${e.x} ${my} L ${e.x} ${e.y}`;
      }
    }
    return 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
  };

  const pathData = buildPath(allPoints);

  // ─── current flow appearance ───────────────────────────────────────────────
  const hasCurrent = Math.abs(simulationCurrent) > 1e-6;
  const strokeColor = isSelected
    ? 'var(--accent-color)'
    : hasCurrent ? 'var(--wire-active)' : 'var(--wire-color)';

  let tooltipText = 'Wire';
  if (hasCurrent) {
    const i = Math.abs(simulationCurrent);
    if (i < 0.001)      tooltipText = `${(i * 1e6).toFixed(2)} µA`;
    else if (i < 1)     tooltipText = `${(i * 1e3).toFixed(2)} mA`;
    else                tooltipText = `${i.toFixed(3)} A`;
  }

  let flowEl = null;
  if (hasCurrent) {
    const i        = Math.abs(simulationCurrent);
    const norm     = Math.min(1, Math.log10(1 + i * 100) / 2);
    const dur      = 1.2 - norm * 1.1;
    const dashLen  = 4 + norm * 6;
    const gapLen   = 14 - norm * 8;
    let dashColor  = '#67e8f9';
    if (i > 0.1) dashColor = '#fbbf24';
    if (i > 0.5) dashColor = '#f97316';
    if (i > 1.0) dashColor = '#ef4444';
    flowEl = (
      <path d={pathData} fill="none" stroke={dashColor}
        strokeWidth={1.5 + norm * 2}
        strokeDasharray={`${dashLen} ${gapLen}`}
        style={{
          animation: `currentFlow ${dur}s linear infinite ${simulationCurrent < 0 ? 'reverse' : 'normal'}`,
          filter: `drop-shadow(0 0 ${3 + norm * 5}px ${dashColor})`,
          pointerEvents: 'none',
        }}
      />
    );
  }

  // ─── drag logic (all handled via useRef so no stale closure bugs) ──────────
  const updateWaypoints = useCallback((newWps) => {
    dispatch({ type: 'UPDATE_WIRE_WAYPOINTS', payload: { id: wire.id, waypoints: newWps } });
  }, [dispatch, wire.id]);

  const onWaypointPointerDown = (e, idx) => {
    e.stopPropagation();
    if (e.button !== 0 || isSimulating) return;
    const el = e.currentTarget;
    const svgEl = el.ownerSVGElement;
    const inverseCTM = el.getScreenCTM().inverse();
    dragRef.current = { wpIndex: idx, inverseCTM, svgEl };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const startDragBody = (e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (!isSelected) { onSelect(wire.id); return; }
    if (isSimulating) return;

    // Capture coordinate transform ONCE at drag start from the clicked element.
    // This element is inside the pan+zoom <g>, so its CTM already includes those.
    const el = e.currentTarget;
    const svgEl = el.ownerSVGElement;
    const inverseCTM = el.getScreenCTM().inverse();
    const pt = clientToWorld(e.clientX, e.clientY, inverseCTM, svgEl);
    const newWp = { x: snap(pt.x), y: snap(pt.y) };

    // Insert at the closest wire segment
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const d = pointToSegmentDist(pt, allPoints[i], allPoints[i + 1]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const newWps = [...waypoints];
    newWps.splice(bestIdx, 0, newWp);
    updateWaypoints(newWps);

    dragRef.current = { wpIndex: bestIdx, inverseCTM, svgEl, pendingWps: newWps };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const pt = clientToWorld(e.clientX, e.clientY, d.inverseCTM, d.svgEl);
    const snapped = { x: snap(pt.x), y: snap(pt.y) };
    const currentWps = d.pendingWps ?? (wire.waypoints || []);
    if (
      currentWps[d.wpIndex] &&
      currentWps[d.wpIndex].x === snapped.x &&
      currentWps[d.wpIndex].y === snapped.y
    ) return;
    const updated = currentWps.map((wp, i) => i === d.wpIndex ? snapped : wp);
    dragRef.current = { ...d, pendingWps: null };
    updateWaypoints(updated);
  }, [wire.waypoints, updateWaypoints]);

  const onPointerUp = (e) => {
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const onWaypointDoubleClick = (e, idx) => {
    e.stopPropagation();
    updateWaypoints(waypoints.filter((_, i) => i !== idx));
  };

  const resetWaypoints = (e) => {
    e.stopPropagation();
    updateWaypoints([]);
  };

  const R = 7 / zoom; // waypoint handle radius

  return (
    <g onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <title>{tooltipText}</title>

      {/* ── Invisible thick hit-box ────────────────────────────────────────── */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={16 / zoom}
        style={{ cursor: isSelected && !isSimulating ? 'cell' : 'pointer' }}
        onPointerDown={startDragBody}
      />

      {/* ── Wire body ──────────────────────────────────────────────────────── */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={(isSelected ? 2.5 : 1.8) / zoom}
        style={{ transition: 'stroke 0.15s', pointerEvents: 'none' }}
      />

      {/* ── Current animation ──────────────────────────────────────────────── */}
      {flowEl}

      {/* ── Waypoint handles (only when selected & not simulating) ─────────── */}
      {isSelected && !isSimulating && waypoints.map((wp, idx) => (
        <g key={`wp-${idx}`}>
          {/* Outer ring */}
          <circle
            cx={wp.x} cy={wp.y} r={R}
            fill="#0f172a"
            stroke="var(--accent-color)"
            strokeWidth={2 / zoom}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => onWaypointPointerDown(e, idx)}
            onDoubleClick={(e) => onWaypointDoubleClick(e, idx)}
          />
          {/* Inner dot */}
          <circle
            cx={wp.x} cy={wp.y} r={2.5 / zoom}
            fill="var(--accent-color)"
            pointerEvents="none"
          />
        </g>
      ))}

      {/* ── Hint label on selected wire with no waypoints ──────────────────── */}
      {isSelected && !isSimulating && waypoints.length === 0 && (() => {
        // Find midpoint of the auto-path to place hint
        const mx = (startCoords.x + endCoords.x) / 2;
        const my = (startCoords.y + endCoords.y) / 2;
        return (
          <text
            x={mx} y={my - 10 / zoom}
            fill="rgba(59,130,246,0.7)"
            fontSize={9 / zoom}
            textAnchor="middle"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            click & drag wire to bend
          </text>
        );
      })()}

      {/* ── Reset button when wire has custom waypoints ─────────────────────── */}
      {isSelected && !isSimulating && waypoints.length > 0 && (() => {
        const rx = (startCoords.x + endCoords.x) / 2;
        const ry = Math.min(startCoords.y, endCoords.y, ...waypoints.map(w => w.y)) - 18 / zoom;
        return (
          <g
            transform={`translate(${rx}, ${ry})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={resetWaypoints}
          >
            <rect
              x={-22 / zoom} y={-9 / zoom}
              width={44 / zoom} height={18 / zoom}
              rx={4 / zoom}
              fill="rgba(15,23,42,0.9)"
              stroke="#3b82f6"
              strokeWidth={1 / zoom}
            />
            <text
              fill="#3b82f6" fontSize={8.5 / zoom}
              textAnchor="middle" dy="0.35em"
              pointerEvents="none"
              style={{ userSelect: 'none' }}
            >
              ↺ auto-route
            </text>
          </g>
        );
      })()}
    </g>
  );
}

/** Minimum distance from point P to line segment AB */
function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
