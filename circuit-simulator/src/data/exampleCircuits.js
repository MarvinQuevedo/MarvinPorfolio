// ─── Example Circuits ────────────────────────────────────────────────────────
//
// Voltage source pin layout (DC_VOLTAGE_SOURCE):
//   pin[0] = nPlus  (+)  → local offsetX=-30
//   pin[1] = nMinus (-)  → local offsetX=+30
//
// User preference: Positive on the RIGHT (+)
// Strategy: rotation=180
//   pin[0] (+) → local(-30,0) rotated 180° → absolute offset (+30, 0) = RIGHT ✓
//   pin[1] (-) → local(+30,0) rotated 180° → absolute offset (-30, 0) = LEFT  ✓
//
// Connection: pin[1] (LEFT) connects to GROUND.

const pId = (cId, idx) => `${cId}_p${idx}`;

const mk2 = (cId) => [
  { id: pId(cId, 0), index: 0, offsetX: -30, offsetY: 0 },
  { id: pId(cId, 1), index: 1, offsetX:  30, offsetY: 0 },
];
const mkGnd = (cId) => [
  { id: pId(cId, 0), index: 0, offsetX: 0, offsetY: 0 },
];
const mkBJT = (cId) => [
  { id: pId(cId, 0), index: 0, offsetX: -30, offsetY:   0 }, // Base
  { id: pId(cId, 1), index: 1, offsetX:  30, offsetY: -24 }, // Collector
  { id: pId(cId, 2), index: 2, offsetX:  30, offsetY:  24 }, // Emitter
];

const W = (id, a, b, wp) => ({ id, startPinId: a, endPinId: b, waypoints: wp || [] });

// Helper factories
const mkSrc = (id, x, y, v = 9) => ({
  id, type: 'DC_VOLTAGE_SOURCE', x, y, rotation: 180, // + Right, - Left
  properties: { voltage: v },
  pins: mk2(id),
});
const mkGndComp = (id, x, y) => ({
  id, type: 'GROUND', x, y, rotation: 0,
  properties: {},
  pins: mkGnd(id),
});
const mkRes = (id, x, y, r, rot = 0) => ({
  id, type: 'RESISTOR', x, y, rotation: rot,
  properties: { resistance: r, maxPower: 0.25 },
  pins: mk2(id),
});
const mkLed = (id, x, y, modelId = 'RED', rot = 0) => {
  const vf = { RED: 1.8, GREEN: 2.2, BLUE: 3.2, YELLOW: 2.1, WHITE: 3.4 };
  return {
    id, type: 'LED', x, y, rotation: rot,
    properties: { modelId, useCustom: false, Vf: vf[modelId] ?? 1.8, Ron: 0.1 },
    pins: mk2(id),
  };
};
const mkDiode = (id, x, y, modelId = '1N4148', rot = 0) => ({
  id, type: 'DIODE', x, y, rotation: rot,
  properties: { modelId, useCustom: false, Vf: 0.7, Ron: 0.1 },
  pins: mk2(id),
});
const mkSwitch = (id, x, y, closed = false) => ({
  id, type: 'SWITCH', x, y, rotation: 0,
  properties: { closed, maxCurrent: 1 },
  pins: mk2(id),
});
const mkBulb = (id, x, y, r = 60, rot = 0) => ({
  id, type: 'BULB', x, y, rotation: rot,
  properties: { resistance: r, maxPower: 2.5 },
  pins: mk2(id),
});
const mkCap = (id, x, y, c = 100e-6, rot = 0, vCap = 0) => ({
  id, type: 'CAPACITOR', x, y, rotation: rot,
  properties: { capacitance: c, maxVoltage: 50, vCap },
  pins: mk2(id),
});
const mkNPN = (id, x, y, modelId = '2N3904', rot = 0) => {
  const m = { '2N3904': { beta:100, Vbe:0.65, Ron:10, maxIc:0.2 }, '2N2222': { beta:150, Vbe:0.60, Ron:5, maxIc:0.6 } };
  return { id, type: 'NPN', x, y, rotation: rot, properties: { modelId, useCustom: false, ...(m[modelId] ?? m['2N3904']) }, pins: mkBJT(id) };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. LED + Resistor (Fixed Polarity: Source + on right)
// ─────────────────────────────────────────────────────────────────────────────
const ledCircuit = () => {
  const V='lc_v', Gv='lc_gv', R='lc_r', L='lc_l', Gl='lc_gl';
  return {
    components: [
      mkSrc(V, 200, 300, 9),      // Source (+ at 230, - at 170)
      mkGndComp(Gv, 140, 300),    // GND connected to - on left
      mkRes(R, 400, 300, 470),
      mkLed(L, 560, 300, 'BLUE'),
      mkGndComp(Gl, 620, 300),
    ],
    wires: [
      W('lw1', pId(V,'1'), pId(Gv,'0')), // - to GND
      W('lw2', pId(V,'0'), pId(R,'0'), [{x: 370, y: 300}]), // + to R
      W('lw3', pId(R,'1'), pId(L,'0')),
      W('lw4', pId(L,'1'), pId(Gl,'0')),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Transistor Blinker (Astable Multivibrator)
// ─────────────────────────────────────────────────────────────────────────────
const blinkerCircuit = () => {
  const V='b_v', G='b_g';
  const Q1='b_q1', Q2='b_q2';
  const C1='b_c1', C2='b_c2';
  const R1='b_r1', R2='b_r2', R3='b_r3', R4='b_r4';
  const L1='b_l1', L2='b_l2';
  const G1='b_g1', G2='b_g2';

  return {
    components: [
      // Power
      mkSrc(V, 100, 100, 9),
      mkGndComp(G, 40, 100),
      
      // Collector Loads (LED + R)
      mkRes(R1, 260, 180, 470, 90),  // Left collector R
      mkLed(L1, 260, 280, 'RED', 90), 
      
      mkRes(R4, 540, 180, 470, 90),  // Right collector R
      mkLed(L2, 540, 280, 'GREEN', 90),

      // Base Pull-ups
      mkRes(R2, 340, 180, 22000, 90), 
      mkRes(R3, 460, 180, 22000, 90),

      // Transistors
      mkNPN(Q1, 260, 420),
      mkNPN(Q2, 540, 420),
      mkGndComp(G1, 290, 480),
      mkGndComp(G2, 570, 480),

      // Capacitors (Cross-coupling)
      // Initial vCap sets the starting state: Q1 ON, Q2 OFF
      // C1 (Q1_C → Q2_B): vCap=+8 drives Q2_B negative → Q2 OFF
      // C2 (Q2_C → Q1_B): vCap=-8 with G_eq pulls Q1_B to ~1V → Q1 ON
      mkCap(C1, 400, 340, 100e-6, 0,  8),
      mkCap(C2, 400, 260, 100e-6, 0, -8),
    ],
    wires: [
      W('bw1', pId(V,'1'), pId(G,'0')), // Source - to GND
      // Power Rail (+)
      W('bw2', pId(V,'0'), pId(R1,'0'), [{x: 260, y: 100}]),
      W('bw3', pId(R1,'0'), pId(R2,'0')),
      W('bw4', pId(R2,'0'), pId(R3,'0')),
      W('bw5', pId(R3,'0'), pId(R4,'0')),

      // Left branch: R1 -> L1 -> Q1 Collector
      W('bw6', pId(R1,'1'), pId(L1,'0')),
      W('bw7', pId(L1,'1'), pId(Q1,'1')),

      // Right branch: R4 -> L2 -> Q2 Collector
      W('bw8', pId(R4,'1'), pId(L2,'0')),
      W('bw9', pId(L2,'1'), pId(Q2,'1')),

      // Emitters to GND
      W('bw10', pId(Q1,'2'), pId(G1,'0')),
      W('bw11', pId(Q2,'2'), pId(G2,'0')),

      // Cross-coupling C1: Left collector to Right base
      // Q1 Collector is at L1 pin 1
      W('bw12', pId(L1,'1'), pId(C1,'0'), [{x: 290, y: 340}]),
      W('bw13', pId(C1,'1'), pId(Q2,'0'), [{x: 510, y: 340}, {x: 510, y: 420}]),

      // Cross-coupling C2: Right collector to Left base
      // Q2 Collector is at L2 pin 1
      W('bw14', pId(L2,'1'), pId(C2,'1'), [{x: 510, y: 260}]),
      W('bw15', pId(C2,'0'), pId(Q1,'0'), [{x: 230, y: 260}, {x: 230, y: 420}]),

      // Base connections to pull-up resistors
      W('bw16', pId(R2,'1'), pId(Q1,'0'), [{x: 340, y: 420}]),
      W('bw17', pId(R3,'1'), pId(Q2,'0'), [{x: 460, y: 420}]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. NPN Transistor Switch
// ─────────────────────────────────────────────────────────────────────────────
const npnSwitchCircuit = () => {
  const V='ns_v', Gv='ns_gv', RB='ns_rb', BJT='ns_bjt', BLB='ns_blb', SW='ns_sw', Gb='ns_gb';
  return {
    components: [
      mkSrc(V, 100, 200, 9),
      mkGndComp(Gv, 40, 200),
      mkSwitch(SW, 240, 100, false),
      mkRes(RB, 380, 100, 1000),
      mkNPN(BJT, 500, 200),
      mkBulb(BLB, 500, 80, 60, 90),
      mkGndComp(Gb, 530, 260),
    ],
    wires: [
      W('sw1', pId(V,'1'), pId(Gv,'0')),
      // Power bus to SW and Bulb
      W('sw2', pId(V,'0'), pId(SW,'0'), [{x: 130, y: 100}]),
      W('sw3', pId(V,'0'), pId(BLB,'0'), [{x: 130, y: 50}, {x: 500, y: 50}]),
      // Base circuit
      W('sw4', pId(SW,'1'), pId(RB,'0')),
      W('sw5', pId(RB,'1'), pId(BJT,'0')),
      // Collector circuit
      W('sw6', pId(BLB,'1'), pId(BJT,'1')),
      W('sw7', pId(BJT,'2'), pId(Gb,'0')),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported catalog
// ─────────────────────────────────────────────────────────────────────────────
export const EXAMPLE_CIRCUITS = [
  {
    id:          'transistor-blinker',
    name:        'Transistor Blinker',
    description: 'Astable Multivibrator using 2 NPN transistors and cross-coupled capacitors. (DC Steady-state: logic shown, oscillation requires time-steps).',
    tags:        ['NPN', 'Capacitor', 'Blink'],
    icon:        '🚥',
    circuit:     blinkerCircuit(),
  },
  {
    id:          'led-resistor',
    name:        'LED + Resistor',
    description: 'Classic circuit with fixed polarity: Source + is on the right, - is connected to Ground on the left.',
    tags:        ['LED', 'Resistor', 'Polarity'],
    icon:        '💡',
    circuit:     ledCircuit(),
  },
  {
    id:          'npn-switch',
    name:        'NPN Transistor Switch',
    description: 'Using an NPN transistor to control a bulb. Source oriented with + to the right per user preference.',
    tags:        ['NPN', 'Switch', 'Transistor'],
    icon:        '🔌',
    circuit:     npnSwitchCircuit(),
  },
];
