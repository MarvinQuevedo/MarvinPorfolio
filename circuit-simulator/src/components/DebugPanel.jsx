import React from 'react';

const COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];
const SCOPE_W = 500;
const SCOPE_H = 110;
const MAX_HISTORY = 300;

function fmtV(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toFixed(2);
}

function fmtI(i) {
  if (i === null || i === undefined || isNaN(i)) return '—';
  const ma = Math.abs(i * 1000);
  if (ma >= 1000) return `${(i).toFixed(2)}A`;
  if (ma >= 1) return `${(i * 1000).toFixed(1)}mA`;
  return `${(i * 1e6).toFixed(0)}µA`;
}

function hexToRgb(hex) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '255,255,255';
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

function VBtn({ pinId, label, nodeVoltages, watchedPins, onTogglePin }) {
  if (!pinId) return <span style={{ color: '#1e293b' }}>—</span>;
  const v = nodeVoltages?.[pinId];
  const watchIdx = watchedPins.indexOf(pinId);
  const watched = watchIdx >= 0;
  const color = watched ? COLORS[watchIdx % COLORS.length] : null;

  return (
    <button
      onClick={() => onTogglePin(pinId)}
      title={`Watch: ${pinId}`}
      style={{
        background: watched ? `rgba(${hexToRgb(color)},0.15)` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${watched ? color : 'rgba(255,255,255,0.08)'}`,
        color: watched ? color : '#64748b',
        borderRadius: '3px',
        padding: '1px 5px',
        fontSize: '0.7rem',
        cursor: 'pointer',
        fontFamily: 'monospace',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label && <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: '2px' }}>{label}:</span>}
      {fmtV(v)}V
    </button>
  );
}

export default function DebugPanel({
  components,
  nodeVoltages,
  branchCurrents,
  historyRef,
  watchedPins,
  onTogglePin,
  simTime,
}) {
  const history = historyRef?.current ?? [];

  // Compute oscilloscope waveforms
  const scopeChannels = watchedPins.map((pinId, ci) => {
    if (history.length < 2) return null;
    const color = COLORS[ci % COLORS.length];
    const vals = history.map(h => h.nodeVoltages?.[pinId] ?? 0);
    const yMin = Math.min(...vals, 0) - 0.5;
    const yMax = Math.max(...vals, 9) + 0.5;
    const range = yMax - yMin || 1;
    const pts = vals.map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * SCOPE_W;
      const y = SCOPE_H - ((v - yMin) / range) * SCOPE_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return { pinId, color, pts, yMin, yMax, current: nodeVoltages?.[pinId] };
  }).filter(Boolean);

  return (
    <div className="debug-panel">
      {/* ── Header ── */}
      <div className="debug-header">
        <span style={{ fontWeight: 600, color: '#60a5fa', fontSize: '0.8rem' }}>
          Circuit Debugger
        </span>
        <span style={{ fontSize: '0.7rem', color: '#334155', marginLeft: '10px' }}>
          t = {simTime.toFixed(3)}s
        </span>
        <span style={{ fontSize: '0.7rem', color: '#1e3a5f', marginLeft: '8px' }}>
          {history.length}/{MAX_HISTORY} samples
        </span>
        <span style={{ fontSize: '0.68rem', color: '#1e3a5f', marginLeft: 'auto' }}>
          Click a voltage to trace in oscilloscope
        </span>
      </div>

      <div className="debug-body">
        {/* ── Component Table ── */}
        <div className="debug-table-wrap">
          <table className="debug-table">
            <thead>
              <tr>
                {['Type', 'ID (Short)', 'Pin A', 'Pin B', 'Pin C', 'ΔV', 'Current', 'State'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {components.filter(c => c.type !== 'GROUND').map(comp => {
                const p0 = comp.pins[0]?.id;
                const p1 = comp.pins[1]?.id;
                const p2 = comp.pins[2]?.id;
                const v0 = nodeVoltages?.[p0];
                const v1 = nodeVoltages?.[p1];
                const dv = (v0 !== undefined && v1 !== undefined) ? v0 - v1 : null;
                const ic = branchCurrents?.[comp.id];
                const damaged = comp.properties.damaged;
                const is3pin = comp.pins.length >= 3;

                let stateEl;
                if (damaged) {
                  stateEl = <span style={{ color: '#f87171' }}>DAMAGED</span>;
                } else if (comp.type === 'CAPACITOR') {
                  const vCap = comp.properties.vCap ?? 0;
                  const pct = Math.min(100, Math.abs(vCap) / (comp.properties.maxVoltage || 50) * 100);
                  stateEl = (
                    <span style={{ color: '#818cf8' }}>
                      {vCap >= 0 ? '+' : ''}{vCap.toFixed(2)}V
                      <span style={{ color: '#1e3a5f', marginLeft: '3px' }}>({pct.toFixed(0)}%)</span>
                    </span>
                  );
                } else if (comp.type === 'NPN' || comp.type === 'PNP') {
                  const active = Math.abs(ic || 0) > 0.001;
                  stateEl = <span style={{ color: active ? '#34d399' : '#334155' }}>{active ? 'ACTIVE' : 'CUTOFF'}</span>;
                } else if (comp.type === 'SWITCH') {
                  stateEl = <span style={{ color: comp.properties.closed ? '#34d399' : '#334155' }}>{comp.properties.closed ? 'CLOSED' : 'OPEN'}</span>;
                } else if (comp.type === 'LED' || comp.type === 'BULB') {
                  const on = Math.abs(ic || 0) > 0.0005;
                  stateEl = <span style={{ color: on ? '#fbbf24' : '#334155' }}>{on ? 'ON' : 'OFF'}</span>;
                }

                return (
                  <tr key={comp.id} style={{ background: damaged ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                    <td style={{ color: '#94a3b8', fontWeight: 500 }}>{comp.type}</td>
                    <td style={{ fontFamily: 'monospace', color: '#334155', fontSize: '0.65rem' }}>{comp.id.substring(0, 8)}</td>
                    <td>
                      <VBtn pinId={p0} label={is3pin ? 'B' : null} nodeVoltages={nodeVoltages} watchedPins={watchedPins} onTogglePin={onTogglePin} />
                    </td>
                    <td>
                      <VBtn pinId={p1} label={is3pin ? 'C' : null} nodeVoltages={nodeVoltages} watchedPins={watchedPins} onTogglePin={onTogglePin} />
                    </td>
                    <td>
                      {p2 ? <VBtn pinId={p2} label="E" nodeVoltages={nodeVoltages} watchedPins={watchedPins} onTogglePin={onTogglePin} /> : <span style={{ color: '#1e293b' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: dv !== null && Math.abs(dv) > 0.05 ? '#cbd5e1' : '#334155' }}>
                      {dv !== null ? `${dv.toFixed(2)}V` : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: Math.abs(ic || 0) > 0.001 ? '#fbbf24' : '#334155' }}>
                      {ic !== undefined ? fmtI(ic) : '—'}
                    </td>
                    <td>{stateEl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Oscilloscope ── */}
        <div className="debug-scope">
          <svg
            width="100%"
            height="110"
            viewBox={`0 0 ${SCOPE_W} ${SCOPE_H}`}
            preserveAspectRatio="none"
            className="debug-scope-svg"
          >
            {/* Grid */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={`h${f}`} x1="0" y1={f * SCOPE_H} x2={SCOPE_W} y2={f * SCOPE_H} stroke="#0c1a2e" strokeWidth="1" />
            ))}
            {[0.2, 0.4, 0.6, 0.8].map(f => (
              <line key={`v${f}`} x1={f * SCOPE_W} y1="0" x2={f * SCOPE_W} y2={SCOPE_H} stroke="#0c1a2e" strokeWidth="1" />
            ))}
            <line x1="0" y1={SCOPE_H / 2} x2={SCOPE_W} y2={SCOPE_H / 2} stroke="#0f2847" strokeWidth="1" />

            {scopeChannels.length === 0 && (
              <text x={SCOPE_W / 2} y={SCOPE_H / 2 + 4} textAnchor="middle" fill="#0f2847" fontSize="11">
                Click a voltage value to trace it here
              </text>
            )}

            {scopeChannels.map(ch => (
              <polyline key={ch.pinId} points={ch.pts} fill="none" stroke={ch.color} strokeWidth="1.5" opacity="0.9" />
            ))}

            {/* Y-axis voltage labels for first channel */}
            {scopeChannels[0] && (
              <>
                <text x="4" y="10" fill={scopeChannels[0].color} fontSize="8" opacity="0.6">
                  {scopeChannels[0].yMax.toFixed(0)}V
                </text>
                <text x="4" y={SCOPE_H - 2} fill={scopeChannels[0].color} fontSize="8" opacity="0.6">
                  {scopeChannels[0].yMin.toFixed(0)}V
                </text>
              </>
            )}
          </svg>

          {/* Channel legend */}
          <div className="debug-scope-legend">
            {scopeChannels.length === 0 && (
              <span style={{ fontSize: '0.65rem', color: '#1e3a5f' }}>No channels active</span>
            )}
            {scopeChannels.map(ch => (
              <div key={ch.pinId} className="debug-scope-channel">
                <span style={{ color: ch.color }}>⬤</span>
                <span className="debug-scope-pin" title={ch.pinId}>{ch.pinId.substring(0, 18)}</span>
                <span style={{ color: ch.color, fontFamily: 'monospace' }}>{fmtV(ch.current)}V</span>
                <button className="debug-scope-remove" onClick={() => onTogglePin(ch.pinId)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}