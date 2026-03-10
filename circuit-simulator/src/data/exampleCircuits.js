// ─── Example Circuits ────────────────────────────────────────────────────────
//
// Voltage source pin layout (DC_VOLTAGE_SOURCE):
//   pin[0] = nPlus  (+)  → local offsetX=-30
//   pin[1] = nMinus (-)  → local offsetX=+30
//
// With rotation=90° (vertical source):
//   pin[0] (+) → local(-30,0) rotated 90° → absolute offset (0, -30) = TOP  ✓
//   pin[1] (-) → local(+30,0) rotated 90° → absolute offset (0, +30) = BOTTOM ✓
//
// Convention for every circuit:
//   - Source is vertical (rotation=90), + on top, - on bottom
//   - GND placed directly below each source's - terminal (short wire or adjacent)
//   - Every branch end has its own GND — no long return wires
//   - Main bus runs horizontally from the + of the source

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
  id, type: 'DC_VOLTAGE_SOURCE', x, y, rotation: 90, // vertical: + top, - bottom
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
const mkLed = (id, x, y, modelId = 'RED') => {
  const vf = { RED: 1.8, GREEN: 2.2, BLUE: 3.2, YELLOW: 2.1, WHITE: 3.4 };
  return {
    id, type: 'LED', x, y, rotation: 0,
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
const mkCap = (id, x, y) => ({
  id, type: 'CAPACITOR', x, y, rotation: 0,
  properties: { capacitance: 100e-6, maxVoltage: 50 },
  pins: mk2(id),
});
const mkNPN = (id, x, y, modelId = '2N3904') => {
  const m = { '2N3904': { beta:100, Vbe:0.65, Ron:10, maxIc:0.2 }, '2N2222': { beta:150, Vbe:0.60, Ron:5, maxIc:0.6 } };
  return { id, type: 'NPN', x, y, rotation: 0, properties: { modelId, useCustom: false, ...(m[modelId] ?? m['2N3904']) }, pins: mkBJT(id) };
};
const mkPNP = (id, x, y, modelId = '2N3906') => ({
  id, type: 'PNP', x, y, rotation: 0,
  properties: { modelId, useCustom: false, beta:100, Vbe:0.65, Ron:10, maxIc:0.2 },
  pins: mkBJT(id),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. LED + Resistor  ─  5V │ 220Ω ─ LED(RED) ─ GND
//    Source vertical at left: + top  → wire right → R → LED → GND
//                             - bot  → GND
// ─────────────────────────────────────────────────────────────────────────────
const ledCircuit = () => {
  // cx=220, cy=360, rotation=90 → pin[0](+) abs=(220, 330)  pin[1](-) abs=(220,390)
  const V='lc_v', Gv='lc_gv', R='lc_r', L='lc_l', Gl='lc_gl';
  const BUS_Y = 300; // horizontal rail y-level
  return {
    components: [
      mkSrc(V,  220, 360, 5),     // vertical source, + at top (y=330)
      mkGndComp(Gv, 220, 430),    // GND below - terminal
      mkRes(R,  420, BUS_Y, 220), // 220Ω horizontal
      mkLed(L,  600, BUS_Y, 'RED'),
      mkGndComp(Gl, 660, 380),    // GND at end of LED
    ],
    wires: [
      // Source + (top, abs y=330) → route up to BUS_Y=300, then right to R left pin (abs x=390)
      W('lw1', pId(V,'0'), pId(R,'0'), [{ x:220, y:BUS_Y }]),
      W('lw2', pId(R,'1'), pId(L,'0')),
      // LED right pin → go down to GND
      W('lw3', pId(L,'1'), pId(Gl,'0'), [{ x:660, y:BUS_Y }, { x:660, y:380 }]),
      // Source - (bot, abs y=390) → GND below
      W('lw4', pId(V,'1'), pId(Gv,'0'), [{ x:220, y:430 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Zener Regulator  ─  12V │ 560Ω ─┬─ 1kΩ load ─ GND
//                                     ↓ Zener (1N4733A 5.1V) ─ GND
// ─────────────────────────────────────────────────────────────────────────────
const zenerCircuit = () => {
  const V='zc_v', Gv='zc_gv';
  const Rs='zc_rs', Rl='zc_rl';
  const Zn='zc_z', Gz='zc_gz', Gl='zc_gl';
  const BUS_Y = 280;
  // Source: cx=180, cy=360 → pin[0](+) at (180,330), pin[1](-) at (180,390)
  // Series R at (380, 280)
  // Junction at x=520, y=280 → Zener goes down, load goes right
  // Zener: rotation=270 → normally (left=anode, right=cathode)
  //   with rot=270: pin[0](anode) goes DOWN, pin[1](cathode) goes UP
  //   So cathode(pin[1]) connects UP to junction, anode(pin[0]) connects DOWN to GND ✓
  return {
    components: [
      mkSrc(V,  180, 360, 12),
      mkGndComp(Gv, 180, 440),
      mkRes(Rs, 380, BUS_Y, 560),
      { ...mkDiode(Zn, 520, 420, '1N4733A'), rotation: 270 }, // vertical shunt: cathode up, anode down
      mkGndComp(Gz, 520, 480),
      mkRes(Rl, 660, BUS_Y, 1000),
      mkGndComp(Gl, 720, 380),
    ],
    wires: [
      // Source + → up to bus, right to Rs
      W('zw1', pId(V,'0'), pId(Rs,'0'), [{ x:180, y:BUS_Y }]),
      // Rs → junction (Zener cathode + Rl)
      // Zener rot=270: pin[1](cathode) abs = (520, 420-30)=(520,390)? Let me recalc:
      // rot=270: cos=-0≈0,sin=-1 → pin[1](offsetX=30): absX=520+30*0=520, absY=420+30*(-1)=390
      // pin[0](anode)(offsetX=-30): absX=520, absY=420+(-30)*(-1)=450
      W('zw2', pId(Rs,'1'), pId(Rl,'0'), [{ x:550, y:BUS_Y }]),
      W('zw3', pId(Rs,'1'), pId(Zn,'1'), [{ x:550, y:BUS_Y }, { x:520, y:BUS_Y }, { x:520, y:390 }]),
      W('zw4', pId(Zn,'0'), pId(Gz,'0'), [{ x:520, y:450 }, { x:520, y:480 }]),
      W('zw5', pId(Rl,'1'), pId(Gl,'0'), [{ x:720, y:BUS_Y }, { x:720, y:380 }]),
      W('zw6', pId(V,'1'), pId(Gv,'0'), [{ x:180, y:440 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. NPN Transistor Switch  ─  controls a bulb with a switch on the base
// VCC(9V) → BULB → Collector─NPN─Emitter → GND
// VB(5V)  → SW   → RBase   → Base
// ─────────────────────────────────────────────────────────────────────────────
const npnSwitchCircuit = () => {
  const VCC='ns_vcc', GVcc='ns_gvcc';
  const VB='ns_vb',   GVb='ns_gvb';
  const BLB='ns_blb', BJT='ns_bjt', GE='ns_ge';
  const SW='ns_sw',   RB='ns_rb';
  // VCC: cx=180,cy=280,rot=90 → pin[0](+) at (180,250), pin[1](-) at (180,310)
  // VB:  cx=100,cy=400,rot=90 → pin[0](+) at (100,370), pin[1](-) at (100,430)
  return {
    components: [
      mkSrc(VCC, 180, 280, 9),
      mkGndComp(GVcc, 180, 360),
      mkBulb(BLB, 380, 240, 60),
      mkNPN(BJT, 560, 320, '2N2222'),
      mkGndComp(GE, 560, 440),      // GND at emitter
      mkSrc(VB,  100, 400, 5),
      mkGndComp(GVb, 100, 480),
      mkSwitch(SW, 260, 380, false),
      mkRes(RB, 420, 380, 10000),
    ],
    wires: [
      // VCC + (180,250) → wire up to y=200, right → bulb left pin (350,200)=wait
      // Bulb at (380,240) rot=0 → pin[0] at (350,240), pin[1] at (410,240)
      W('nw1', pId(VCC,'0'), pId(BLB,'0'), [{ x:180, y:200 }, { x:350, y:200 }, { x:350, y:240 }]),
      // Bulb right → Collector (BJT pin[1])
      // BJT at (560,320) → Collector abs = (560+30, 320-24) = (590,296)
      W('nw2', pId(BLB,'1'), pId(BJT,'1'), [{ x:410, y:240 }, { x:590, y:240 }, { x:590, y:296 }]),
      // Emitter (590,344) → GND below
      W('nw3', pId(BJT,'2'), pId(GE,'0'),  [{ x:590, y:344 }, { x:590, y:440 }, { x:560, y:440 }]),
      // VCC - → GND
      W('nw4', pId(VCC,'1'), pId(GVcc,'0'), [{ x:180, y:360 }]),
      // Base circuit: VB+(100,370) → SW → RB → Base(BJT pin[0])
      // BJT Base abs = (560-30, 320) = (530,320)
      W('nw5', pId(VB,'0'), pId(SW,'0'), [{ x:100, y:380 }]),
      W('nw6', pId(SW,'1'), pId(RB,'0')),
      W('nw7', pId(RB,'1'), pId(BJT,'0')),
      W('nw8', pId(VB,'1'), pId(GVb,'0'), [{ x:100, y:480 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PNP High-Side Switch  ─  VCC → Emitter─PNP─Collector → BULB → GND
// ─────────────────────────────────────────────────────────────────────────────
const pnpCircuit = () => {
  const V='pp_v', GV='pp_gv';
  const BJT='pp_bjt', BLB='pp_blb', GB='pp_gb';
  const SW='pp_sw', RB='pp_rb', GRB='pp_grb';
  // Source: cx=180,cy=300,rot=90 → pin[0](+) at (180,270), pin[1](-) at (180,330)
  // PNP at (500,300,rot=0): Emitter(pin[2]) at (530,324), Collector(pin[1]) at (530,276), Base(pin[0]) at (470,300)
  return {
    components: [
      mkSrc(V,   180, 300, 12),
      mkGndComp(GV, 180, 380),
      mkPNP(BJT, 500, 300, '2N3906'),
      mkBulb(BLB, 560, 420, 100),
      mkGndComp(GB, 560, 520),
      mkRes(RB,  360, 300, 47000),
      mkSwitch(SW, 240, 300, false),
      mkGndComp(GRB, 420, 420),   // pull-down for base
    ],
    wires: [
      // VCC + (180,270) → wire to Emitter (530,324)
      W('pw1', pId(V,'0'), pId(BJT,'2'), [{ x:180, y:240 }, { x:530, y:240 }, { x:530, y:324 }]),
      // Collector (530,276) → Bulb → GND
      W('pw2', pId(BJT,'1'), pId(BLB,'0'), [{ x:530, y:276 }, { x:590, y:276 }, { x:590, y:392 }]),
      W('pw3', pId(BLB,'1'), pId(GB,'0'),  [{ x:590, y:448 }, { x:590, y:520 }, { x:560, y:520 }]),
      // VCC - → GND
      W('pw4', pId(V,'1'), pId(GV,'0'), [{ x:180, y:380 }]),
      // Base circuit: VCC+ → SW → RB → Base (470,300)
      W('pw5', pId(V,'0'), pId(SW,'0'), [{ x:180, y:270 }, { x:180, y:260 }, { x:270, y:260 }, { x:270, y:300 }]),
      W('pw6', pId(SW,'1'), pId(RB,'0')),
      W('pw7', pId(RB,'1'), pId(BJT,'0')),
      // Pull-down base to GND (keeps base well-defined)
      W('pw8', pId(GRB,'0'), pId(RB,'1'), [{ x:420, y:420 }, { x:420, y:300 }, { x:390, y:300 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. RC Charging Circuit  ─  9V │ SW ─ 10kΩ ─ Capacitor ─ GND
// ─────────────────────────────────────────────────────────────────────────────
const rcCircuit = () => {
  const V='rc_v', GV='rc_gv';
  const SW='rc_sw', R='rc_r', C='rc_c', GC='rc_gc';
  const BUS_Y = 280;
  return {
    components: [
      mkSrc(V,  180, 360, 9),
      mkGndComp(GV, 180, 440),
      mkSwitch(SW, 340, BUS_Y, false),
      mkRes(R,  500, BUS_Y, 10000),
      mkCap(C,  660, 340),
      mkGndComp(GC, 720, 420),
    ],
    wires: [
      W('rcw1', pId(V,'0'), pId(SW,'0'), [{ x:180, y:BUS_Y }]),
      W('rcw2', pId(SW,'1'), pId(R,'0')),
      W('rcw3', pId(R,'1'),  pId(C,'0'), [{ x:580, y:BUS_Y }, { x:580, y:340 }]),
      W('rcw4', pId(C,'1'),  pId(GC,'0'), [{ x:720, y:340 }, { x:720, y:420 }]),
      W('rcw5', pId(V,'1'),  pId(GV,'0'), [{ x:180, y:440 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Diode Bridge Rectifier  ─  12V → 4× 1N4007 bridge → 1kΩ load
//
// Layout:
//   AC+ (top rail) ──D1──┐
//                         ├── out+ ─ Rl ─ GND
//   AC- (bot rail) ──D2──┘
//        ┌──D3── AC- (bot)
//   out- ┤
//        └──D4── AC+ (top)
//
// Simplified DC input: V(12V) + to top-rail, V(-) to bottom-rail (=GND via source -)
// ─────────────────────────────────────────────────────────────────────────────
const bridgeCircuit = () => {
  const V='br_v', GV='br_gv';
  const D1='br_d1', D2='br_d2', D3='br_d3', D4='br_d4';
  const RL='br_rl', GRL='br_grl', GOUT='br_gout';

  // Source vertical at (180,360): +(180,330) = top-rail, -(180,390) = bot-rail (≡ GND)
  // D1 rot=0: current flows left→right: anode(pin[0])←top-rail, cathode(pin[1])→out+
  // D2 rot=180: reversed, anode on right (abs x+30 rotated = left), cathode on left
  //   Actually: rot=180 → pin[0](left-local) appears on RIGHT → anode on RIGHT (feeds from bot-rail ON RIGHT?)
  // Let me simplify: just use two diodes pointing RIGHT on top arm, two on bottom arm

  // Top arm (positive half):  top-rail → D1(→) → out+
  // Bottom arm to out+:       bot-rail → D3(→) → out+ (D3 rot=180 so it flows bot-rail→out+? no)
  // 
  // Standard bridge:
  //   D1: anode=top-rail, cathode=out+
  //   D2: anode=bot-rail, cathode=out+
  //   D3: anode=out-,     cathode=top-rail (reversed: rot=180 → same as anode on right)
  //   D4: anode=out-,     cathode=bot-rail
  //
  // In simplest DC case:
  //   top-rail = V+(12V), bot-rail = GND(0V)
  //   out+ ≈ V+ - Vf (through D1)
  //   out- = GND (through D4 forward biased)
  //   D2 reverse biased (bot-rail=0 < out+=11.3V)
  //   D3 reverse biased
  //   Result: out+ = 11.3V, out- = 0V, Rl gets 11.3V across it ✓

  return {
    components: [
      mkSrc(V,   180, 400, 12),
      mkGndComp(GV, 180, 480),    // source - to GND (bot rail = 0V = GND)
      // D1: top-rail → out+ (rot=0, left=anode, right=cathode)
      mkDiode(D1, 400, 280, '1N4007', 0),
      // D2: bot-rail → out+ (rot=0, left=anode=bot-rail≡GND, right=cathode=out+)
      mkDiode(D2, 400, 480, '1N4007', 0),
      // D3: out- → top-rail reversed (rot=180: left visual=cathode=top-rail, right visual=anode← won't conduct DC)
      mkDiode(D3, 560, 280, '1N4007', 180),
      // D4: out- → bot-rail reversed (rot=180)
      mkDiode(D4, 560, 480, '1N4007', 180),
      // Load: out+ to out- (vertical)
      mkRes(RL,  700, 380, 1000, 90),
      mkGndComp(GRL, 760, 480),   // out- = GND
      mkGndComp(GOUT, 300, 280),  // top-rail returns (GND side of D3/D4 - not needed in DC but helpful)
    ],
    wires: [
      // Source + (180,370) → top-rail → D1 anode (370,280)
      W('bw1', pId(V,'0'), pId(D1,'0'), [{ x:180, y:240 }, { x:370, y:240 }, { x:370, y:280 }]),
      // D1 cathode (430,280) → out+ → D3 anode (530,280) (D3 rot=180 → pin[0] absX=530+30=560,absY=280? no)
      // D3 rot=180: cos(180)=-1, sin=0 → pin[0](offsetX=-30): absX=560+(-30*-1)=590, absY=280 → pin[0] on RIGHT=cathode-visual
      // Actually for rot=180: pin[0](+=left→appears RIGHT) and pin[1](-=right→appears LEFT? no-)
      // pin[0] MNA = nPlus. For D3 rot=180: visual right side is pin[0](anode=+) — this confused things.
      // Let's just use direct connects with waypoints for the bridge:
      // Top rail: V+ → D1 anode, also connects D3's anode (but D3 rot=180 so its pin[1] is cathode visual-left)
      // For simplicity in DC: just show D1 and D4 conducting in standard DC:
      W('bw2', pId(D1,'1'), pId(D3,'1'), [{ x:430, y:280 }, { x:530, y:280 }]),  // out+
      W('bw3', pId(D1,'1'), pId(RL,'0'), [{ x:430, y:280 }, { x:430, y:200 }, { x:730, y:200 }, { x:730, y:350 }]),
      // Bot-rail (GND) → D2 anode (370,480)
      W('bw4', pId(V,'1'), pId(D2,'0'), [{ x:180, y:480 }, { x:370, y:480 }]),
      // D2 cathode (430,480) → D4 cathode (530,480)
      W('bw5', pId(D2,'1'), pId(D4,'1'), [{ x:430, y:480 }, { x:530, y:480 }]),
      // out-: bot-rail → GND
      W('bw6', pId(D2,'0'), pId(GRL,'0'), [{ x:370, y:480 }, { x:370, y:520 }, { x:760, y:520 }, { x:760, y:480 }]),
      W('bw7', pId(RL,'1'), pId(GRL,'0'), [{ x:730, y:410 }, { x:730, y:480 }, { x:760, y:480 }]),
      // D3 and D4: connect anodes to top/bot rail respectively
      W('bw8', pId(D3,'0'), pId(V,'0'), [{ x:590, y:280 }, { x:590, y:240 }, { x:180, y:240 }]),
      W('bw9', pId(D4,'0'), pId(V,'1'), [{ x:590, y:480 }, { x:590, y:520 }, { x:180, y:520 }, { x:180, y:480 }]),
      W('bwg', pId(V,'1'), pId(GV,'0'), [{ x:180, y:480 }]),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. RGB LED Array  ─  5V │ SW ─┬─ 100Ω─RED ─ GND
//                               ├─  82Ω─GRN ─ GND
//                               └─  56Ω─BLU ─ GND
// ─────────────────────────────────────────────────────────────────────────────
const multiLedCircuit = () => {
  const V='ml_v', GV='ml_gv';
  const SW='ml_sw';
  const RR='ml_rr', LR='ml_lr', GR='ml_gr';
  const RG='ml_rg', LG='ml_lg', GG='ml_gg';
  const RB='ml_rb', LB='ml_lb', GB='ml_gb';

  // Source: cx=180,cy=380,rot=90 → + at (180,350), - at (180,410)
  // Switch: cx=300,cy=350 → left=(270,350), right=(330,350)
  // Bus node at (360, 350), branches fan downward
  return {
    components: [
      mkSrc(V,   180, 380, 5),
      mkGndComp(GV, 180, 460),
      mkSwitch(SW, 300, 260, true),
      // Red branch: y=200
      mkRes(RR, 460, 200, 100),
      mkLed(LR, 620, 200, 'RED'),
      mkGndComp(GR, 680, 300),
      // Green branch: y=360
      mkRes(RG, 460, 360, 82),
      mkLed(LG, 620, 360, 'GREEN'),
      mkGndComp(GG, 680, 460),
      // Blue branch: y=520
      mkRes(RB, 460, 520, 56),
      mkLed(LB, 620, 520, 'BLUE'),
      mkGndComp(GB, 680, 620),
    ],
    wires: [
      // V+(180,350) → SW left pin
      W('mw0', pId(V,'0'), pId(SW,'0'), [{ x:180, y:260 }]),
      // SW right → bus at (380,260), fans to three branches
      W('mw1', pId(SW,'1'), pId(RR,'0'), [{ x:380, y:260 }, { x:380, y:200 }]),
      W('mw2', pId(SW,'1'), pId(RG,'0'), [{ x:380, y:260 }, { x:380, y:360 }]),
      W('mw3', pId(SW,'1'), pId(RB,'0'), [{ x:380, y:260 }, { x:380, y:520 }]),
      // Each R → LED → GND
      W('mw4', pId(RR,'1'), pId(LR,'0')),
      W('mw5', pId(LR,'1'), pId(GR,'0'), [{ x:680, y:200 }, { x:680, y:300 }]),
      W('mw6', pId(RG,'1'), pId(LG,'0')),
      W('mw7', pId(LG,'1'), pId(GG,'0'), [{ x:680, y:360 }, { x:680, y:460 }]),
      W('mw8', pId(RB,'1'), pId(LB,'0')),
      W('mw9', pId(LB,'1'), pId(GB,'0'), [{ x:680, y:520 }, { x:680, y:620 }]),
      // V- → GND
      W('mwa', pId(V,'1'), pId(GV,'0'), [{ x:180, y:460 }]),
    ],
  };
};

// ─── Exported catalog ────────────────────────────────────────────────────────
export const EXAMPLE_CIRCUITS = [
  {
    id:          'led-resistor',
    name:        'LED + Resistor',
    description: 'Classic beginner circuit: current-limiting resistor (220Ω) drives a red LED from 5V. Press Start Simulation to see the LED glow.',
    tags:        ['LED', 'Resistor', 'Beginner'],
    icon:        '💡',
    circuit:     ledCircuit(),
  },
  {
    id:          'zener-regulator',
    name:        'Zener Voltage Regulator',
    description: '12V regulated to ~5.1V using a 1N4733A Zener diode and series resistor. Ideal for stable reference voltages.',
    tags:        ['Zener', 'Diode', 'Regulator'],
    icon:        '⚡',
    circuit:     zenerCircuit(),
  },
  {
    id:          'npn-switch',
    name:        'NPN Transistor Switch',
    description: '2N2222 NPN transistor controls a bulb. Toggle the Switch to turn the lamp ON/OFF via the base current.',
    tags:        ['NPN', 'Transistor', 'Switch'],
    icon:        '🔌',
    circuit:     npnSwitchCircuit(),
  },
  {
    id:          'pnp-switch',
    name:        'PNP High-Side Switch',
    description: 'PNP transistor controlling a load connected to VCC. Toggle Switch to control the bulb.',
    tags:        ['PNP', 'Transistor', 'Switch'],
    icon:        '🔋',
    circuit:     pnpCircuit(),
  },
  {
    id:          'rc-circuit',
    name:        'RC Charging Circuit',
    description: 'Resistor-Capacitor circuit. Close the Switch to charge the capacitor through 10kΩ. DC steady-state shown.',
    tags:        ['Capacitor', 'Resistor', 'RC'],
    icon:        '🌊',
    circuit:     rcCircuit(),
  },
  {
    id:          'bridge-rectifier',
    name:        '4-Diode Bridge Rectifier',
    description: 'Full-wave diode bridge using four 1N4007 rectifier diodes. Converts 12V input across a 1kΩ load.',
    tags:        ['Diode', '1N4007', 'Rectifier'],
    icon:        '🔷',
    circuit:     bridgeCircuit(),
  },
  {
    id:          'multi-led',
    name:        'RGB LED Array',
    description: 'Three LEDs (Red, Green, Blue) in parallel with individual current-limiting resistors. Toggle the master switch.',
    tags:        ['LED', 'Parallel', 'RGB'],
    icon:        '🌈',
    circuit:     multiLedCircuit(),
  },
];
