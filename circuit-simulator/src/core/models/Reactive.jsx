import BaseComponent from './BaseComponent.jsx';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITOR
// In DC steady-state (which our MNA solves) a capacitor is an open circuit.
// We model it as a very high resistance (1e9 Ω) so it doesn't short the circuit,
// but exposes its capacitance as an editable property for future AC/transient sim.
// ─────────────────────────────────────────────────────────────────────────────
export class CapacitorModel extends BaseComponent {
  get type() { return 'CAPACITOR'; }
  get label() { return 'Capacitor'; }
  get category() { return 'Passive'; }
  get numPins() { return 2; }
  get defaultProperties() { return { capacitance: 100e-6, maxVoltage: 50 }; }
  get propertyMeta() {
    return {
      capacitance: { label: 'Capacitance (F)', type: 'number', step: '1e-6' },
      maxVoltage: { label: 'Max Voltage (V)', type: 'number', min: 0 }
    };
  }
  get color() { return '#818cf8'; } // indigo

  applyMNA(A, Z, componentState, finalNodeMap) {
    if (componentState.properties.damaged) return;
    // DC steady‑state ≈ open circuit
    const G = 1e-9;
    const n1 = finalNodeMap.get(componentState.pins[0].id) || 0;
    const n2 = finalNodeMap.get(componentState.pins[1].id) || 0;
    if (n1 > 0) A[n1 - 1][n1 - 1] += G;
    if (n2 > 0) A[n2 - 1][n2 - 1] += G;
    if (n1 > 0 && n2 > 0) {
      A[n1 - 1][n2 - 1] -= G;
      A[n2 - 1][n1 - 1] -= G;
    }
  }

  extractCurrent(componentState, nodeVoltages) {
    return 0; // open circuit in DC steady state
  }

  checkDamage(componentState, current, voltage) {
    if (componentState.properties.damaged) return false;
    const maxV = componentState.properties.maxVoltage ?? 50;
    if (Math.abs(voltage) > maxV) {
      return `Overvoltage: ${Math.abs(voltage).toFixed(1)}V exceeded the ${maxV}V capacitor rating. Dielectric breakdown.`;
    }
    return false;
  }

  renderShape(componentState, simulationCurrent) {
    const isCharged = Math.abs(simulationCurrent) > 1e-6;
    const c = this.color;
    return (
      <g>
        <line x1="-30" y1="0" x2="-6" y2="0" stroke={c} strokeWidth="3" />
        <line x1="6" y1="0" x2="30" y2="0" stroke={c} strokeWidth="3" />
        <line x1="-6" y1="-14" x2="-6" y2="14" stroke={c} strokeWidth={isCharged ? 4 : 3}
          style={{ filter: isCharged ? `drop-shadow(0 0 4px ${c})` : 'none', transition: 'all 0.2s' }}
        />
        <line x1="6" y1="-14" x2="6" y2="14" stroke={c} strokeWidth={isCharged ? 4 : 3}
          style={{ filter: isCharged ? `drop-shadow(0 0 4px ${c})` : 'none', transition: 'all 0.2s' }}
        />
        {/* + label */}
        <text x="-14" y="-16" fill={c} fontSize="9" textAnchor="middle">+</text>
      </g>
    );
  }

  renderIcon() {
    const c = this.color;
    return (
      <g>
        <line x1="-30" y1="0" x2="-8" y2="0" stroke={c} strokeWidth="4" />
        <line x1="8" y1="0" x2="30" y2="0" stroke={c} strokeWidth="4" />
        <line x1="-8" y1="-18" x2="-8" y2="18" stroke={c} strokeWidth="5" />
        <line x1="8" y1="-18" x2="8" y2="18" stroke={c} strokeWidth="5" />
      </g>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BJT NPN TRANSISTOR
//
// Pins: [0]=Base, [1]=Collector, [2]=Emitter
// DC model: Ebers-Moll simplified (piecewise linear)
//   IC = β * IB     when VBE > Vbe_on
//   Emitter current IE = IB + IC   (KCL)
// MNA stamps:
//   VBE junction modeled as a diode (Vbe_on, Ron)
//   Collector current injected as a current-controlled current source β*IB
// ─────────────────────────────────────────────────────────────────────────────
export class NpnTransistorModel extends BaseComponent {
  get type() { return 'NPN'; }
  get label() { return 'NPN Transistor'; }
  get category() { return 'Semiconductors'; }
  get numPins() { return 3; } // Base, Collector, Emitter
  get defaultProperties() { return { beta: 100, Vbe: 0.7, Ron: 10, maxIc: 0.6 }; }
  get propertyMeta() {
    return {
      beta: { label: 'β (hFE gain)', type: 'number', min: 1 },
      Vbe: { label: 'V_BE threshold (V)', type: 'number', min: 0 },
      Ron: { label: 'Ron Base-Emitter (Ω)', type: 'number', min: 0.01 },
      maxIc: { label: 'Max Collector I (A)', type: 'number', min: 0 }
    };
  }
  get color() { return '#34d399'; } // emerald

  applyMNA(A, Z, componentState, resolvedNodeMap, extraVarIndices, lastNodeVoltages) {
    if (componentState.properties.damaged) return;
    const { beta, Vbe: Vbe_on, Ron } = componentState.properties;
    const pB = componentState.pins[0].id;
    const pC = componentState.pins[1].id;
    const pE = componentState.pins[2].id;

    const nB = resolvedNodeMap.get(pB) || 0;
    const nC = resolvedNodeMap.get(pC) || 0;
    const nE = resolvedNodeMap.get(pE) || 0;

    const vB = lastNodeVoltages ? (lastNodeVoltages[pB] || 0) : 0;
    const vE = lastNodeVoltages ? (lastNodeVoltages[pE] || 0) : 0;
    const Vbe = vB - vE;

    // ── Stamp base-emitter junction diode ──
    let G_be = 1e-9;
    let Ieq = 0;

    if (Vbe > Vbe_on) {
      G_be = 1.0 / Ron;
      Ieq  = Vbe_on * G_be; // Norton current to maintain Vbe_on drop
    }

    if (nB > 0) A[nB - 1][nB - 1] += G_be;
    if (nE > 0) A[nE - 1][nE - 1] += G_be;
    if (nB > 0 && nE > 0) {
      A[nB - 1][nE - 1] -= G_be;
      A[nE - 1][nB - 1] -= G_be;
    }
    if (nB > 0) Z[nB - 1] += Ieq;
    if (nE > 0) Z[nE - 1] -= Ieq;

    // ── Stamp collector current source β*IB ──
    // IB = (Vbe - Vbe_on) / Ron  when active
    // IC = β * IB, flows from C to E
    if (Vbe > Vbe_on) {
      const Ib = (Vbe - Vbe_on) / Ron;
      const Ic = beta * Ib;

      // current source from C to E (conventional: out of C, into E)
      if (nC > 0) Z[nC - 1] -= Ic;
      if (nE > 0) Z[nE - 1] += Ic;

      // Collector conductance (small shunt to ground for numerical stability)
      const G_ce = 1e-6;
      if (nC > 0) A[nC - 1][nC - 1] += G_ce;
      if (nE > 0) A[nE - 1][nE - 1] += G_ce;
      if (nC > 0 && nE > 0) {
        A[nC - 1][nE - 1] -= G_ce;
        A[nE - 1][nC - 1] -= G_ce;
      }
    }
  }

  extractCurrent(componentState, nodeVoltages) {
    if (componentState.properties.damaged) return 0;
    const { beta, Vbe: Vbe_on, Ron } = componentState.properties;
    const vB = nodeVoltages[componentState.pins[0].id] || 0;
    const vE = nodeVoltages[componentState.pins[2].id] || 0;
    const Vbe = vB - vE;
    if (Vbe > Vbe_on) {
      const Ib = (Vbe - Vbe_on) / Ron;
      return beta * Ib; // Ic
    }
    return 0;
  }

  checkDamage(componentState, current, voltage) {
    if (componentState.properties.damaged) return false;
    const maxIc = componentState.properties.maxIc ?? 0.6;
    if (current > maxIc) {
      return `Collector overcurrent: ${(current * 1000).toFixed(0)}mA exceeded ${(maxIc * 1000).toFixed(0)}mA max. Junction destroyed.`;
    }
    return false;
  }

  renderShape(componentState, simulationCurrent) {
    const c = this.color;
    const active = simulationCurrent > 0.001;
    const glow = active ? `drop-shadow(0 0 6px ${c})` : 'none';
    return (
      <g style={{ filter: glow, transition: 'filter 0.2s' }}>
        {/* Body circle */}
        <circle cx="0" cy="0" r="18" fill="none" stroke={c} strokeWidth="2" />
        {/* Base lead (left) */}
        <line x1="-30" y1="0" x2="-6" y2="0" stroke={c} strokeWidth="3" />
        {/* Vertical base bar */}
        <line x1="-6" y1="-12" x2="-6" y2="12" stroke={c} strokeWidth="3" />
        {/* Collector lead (top right) — pin[1] */}
        <line x1="-6" y1="-10" x2="14" y2="-24" stroke={c} strokeWidth="3" />
        <line x1="14" y1="-24" x2="30" y2="-24" stroke={c} strokeWidth="3" />
        {/* Emitter lead (bottom right) — pin[2] with arrow */}
        <line x1="-6" y1="10" x2="14" y2="24" stroke={c} strokeWidth="3" />
        <line x1="14" y1="24" x2="30" y2="24" stroke={c} strokeWidth="3" />
        {/* NPN arrow on emitter (pointing outward from base) */}
        <polygon points="10,20 16,26 8,28" fill={c} />
        {/* Labels */}
        <text x="-30" y="-8" fill={c} fontSize="7" textAnchor="start">B</text>
        <text x="18" y="-22" fill={c} fontSize="7">C</text>
        <text x="18" y="30" fill={c} fontSize="7">E</text>
      </g>
    );
  }

  renderIcon() {
    const c = this.color;
    return (
      <g>
        <circle cx="0" cy="0" r="22" fill="none" stroke={c} strokeWidth="3" />
        <line x1="-30" y1="0" x2="-8" y2="0" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="-14" x2="-8" y2="14" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="-11" x2="14" y2="-28" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="11" x2="14" y2="28" stroke={c} strokeWidth="3" />
        <polygon points="8,24 16,29 8,32" fill={c} />
      </g>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BJT PNP TRANSISTOR
// Same as NPN but polarity flipped (VEB instead of VBE, IC flows E→C)
// Pins: [0]=Base, [1]=Collector, [2]=Emitter
// ─────────────────────────────────────────────────────────────────────────────
export class PnpTransistorModel extends NpnTransistorModel {
  get type() { return 'PNP'; }
  get label() { return 'PNP Transistor'; }
  get color() { return '#f472b6'; } // pink

  applyMNA(A, Z, componentState, resolvedNodeMap, extraVarIndices, lastNodeVoltages) {
    if (componentState.properties.damaged) return;
    const { beta, Vbe: Vbe_on, Ron } = componentState.properties;
    const pB = componentState.pins[0].id;
    const pC = componentState.pins[1].id;
    const pE = componentState.pins[2].id;

    const nB = resolvedNodeMap.get(pB) || 0;
    const nC = resolvedNodeMap.get(pC) || 0;
    const nE = resolvedNodeMap.get(pE) || 0;

    const vB = lastNodeVoltages ? (lastNodeVoltages[pB] || 0) : 0;
    const vE = lastNodeVoltages ? (lastNodeVoltages[pE] || 0) : 0;
    const Veb = vE - vB; // PNP uses V_EB

    // ── Stamp emitter-base junction diode (reversed polarity) ──
    let G_eb = 1e-9;
    let Ieq = 0;

    if (Veb > Vbe_on) {
      G_eb = 1.0 / Ron;
      Ieq  = Vbe_on * G_eb;
    }

    // Stamp current from E to B (reversed)
    if (nE > 0) A[nE - 1][nE - 1] += G_eb;
    if (nB > 0) A[nB - 1][nB - 1] += G_eb;
    if (nE > 0 && nB > 0) {
      A[nE - 1][nB - 1] -= G_eb;
      A[nB - 1][nE - 1] -= G_eb;
    }
    if (nE > 0) Z[nE - 1] += Ieq;
    if (nB > 0) Z[nB - 1] -= Ieq;

    // ── PNP collector current source (flows from E to C) ──
    if (Veb > Vbe_on) {
      const Ib = (Veb - Vbe_on) / Ron;
      const Ic = beta * Ib;

      if (nE > 0) Z[nE - 1] -= Ic;
      if (nC > 0) Z[nC - 1] += Ic;

      const G_ec = 1e-6;
      if (nE > 0) A[nE - 1][nE - 1] += G_ec;
      if (nC > 0) A[nC - 1][nC - 1] += G_ec;
      if (nE > 0 && nC > 0) {
        A[nE - 1][nC - 1] -= G_ec;
        A[nC - 1][nE - 1] -= G_ec;
      }
    }
  }

  extractCurrent(componentState, nodeVoltages) {
    if (componentState.properties.damaged) return 0;
    const { beta, Vbe: Vbe_on, Ron } = componentState.properties;
    const vB = nodeVoltages[componentState.pins[0].id] || 0;
    const vE = nodeVoltages[componentState.pins[2].id] || 0;
    const Veb = vE - vB;
    if (Veb > Vbe_on) {
      const Ib = (Veb - Vbe_on) / Ron;
      return -(beta * Ib); // IC flows into Collector in PNP (negative convention)
    }
    return 0;
  }

  renderShape(componentState, simulationCurrent) {
    const c = this.color;
    const active = Math.abs(simulationCurrent) > 0.001;
    const glow = active ? `drop-shadow(0 0 6px ${c})` : 'none';
    return (
      <g style={{ filter: glow, transition: 'filter 0.2s' }}>
        <circle cx="0" cy="0" r="18" fill="none" stroke={c} strokeWidth="2" />
        <line x1="-30" y1="0" x2="-6" y2="0" stroke={c} strokeWidth="3" />
        <line x1="-6" y1="-12" x2="-6" y2="12" stroke={c} strokeWidth="3" />
        {/* Collector */}
        <line x1="-6" y1="-10" x2="14" y2="-24" stroke={c} strokeWidth="3" />
        <line x1="14" y1="-24" x2="30" y2="-24" stroke={c} strokeWidth="3" />
        {/* Emitter */}
        <line x1="-6" y1="10" x2="14" y2="24" stroke={c} strokeWidth="3" />
        <line x1="14" y1="24" x2="30" y2="24" stroke={c} strokeWidth="3" />
        {/* PNP arrow on emitter (pointing INTO base) */}
        <polygon points="-2,12 6,8 2,16" fill={c} />
        <text x="-30" y="-8" fill={c} fontSize="7" textAnchor="start">B</text>
        <text x="18" y="-22" fill={c} fontSize="7">C</text>
        <text x="18" y="30" fill={c} fontSize="7">E</text>
      </g>
    );
  }

  renderIcon() {
    const c = this.color;
    return (
      <g>
        <circle cx="0" cy="0" r="22" fill="none" stroke={c} strokeWidth="3" />
        <line x1="-30" y1="0" x2="-8" y2="0" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="-14" x2="-8" y2="14" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="-11" x2="14" y2="-28" stroke={c} strokeWidth="3" />
        <line x1="-8" y1="11" x2="14" y2="28" stroke={c} strokeWidth="3" />
        {/* PNP arrow into base */}
        <polygon points="-4,14 4,9 0,18" fill={c} />
      </g>
    );
  }
}
