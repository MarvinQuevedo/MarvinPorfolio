import { registry } from './ComponentRegistry';

export function solveLinearSystem(A, B) {
  const n = A.length;
  // Augment matrix
  const M = A.map((row, i) => [...row, B[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    [M[maxRow], M[i]] = [M[i], M[maxRow]];

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      // Guard against div by zero if singular A
      if (Math.abs(M[i][i]) < 1e-12) continue; 
      const c = -M[k][i] / M[i][i];
      for (let j = i; j < n + 1; j++) {
        if (i === j) {
          M[k][j] = 0;
        } else {
          M[k][j] += c * M[i][j];
        }
      }
    }
  }

  // Solve equation Ax=B for an upper triangular matrix
  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    if (Math.abs(M[i][i]) < 1e-12) {
      x[i] = 0; // Floating / unconnected node
    } else {
      x[i] = M[i][n] / M[i][i];
      for (let k = i - 1; k > -1; k--) {
        M[k][n] -= M[k][i] * x[i];
      }
    }
  }
  return x;
}

export function simulateCircuit(components, wires) {
  const pinToNode = new Map();
  let nodeCount = 0;

  const getOrAssignNode = (pinId) => {
    if (!pinToNode.has(pinId)) {
      pinToNode.set(pinId, ++nodeCount);
    }
    return pinToNode.get(pinId);
  };

  const mergeNodes = (nodeA, nodeB) => {
    if (nodeA === nodeB) return nodeA;
    for (const [pinId, n] of pinToNode.entries()) {
      if (n === nodeB) pinToNode.set(pinId, nodeA);
    }
    return nodeA;
  };

  components.forEach(c => {
    c.pins.forEach(p => getOrAssignNode(p.id));
  });

  wires.forEach(w => {
    const nodeA = getOrAssignNode(w.startPinId);
    const nodeB = getOrAssignNode(w.endPinId);
    mergeNodes(nodeA, nodeB);
  });

  // Virtually connect all GROUND components together
  const groundPins = [];
  components.forEach(c => {
    if (c.type === 'GROUND' && c.pins.length > 0) {
      groundPins.push(c.pins[0].id);
    }
  });

  if (groundPins.length > 1) {
    const firstGroundNode = getOrAssignNode(groundPins[0]);
    for (let i = 1; i < groundPins.length; i++) {
      mergeNodes(firstGroundNode, getOrAssignNode(groundPins[i]));
    }
  }

  const uniqueNodes = Array.from(new Set(pinToNode.values()));
  
  let groundOriginalNode = null;
  const grounds = components.filter(c => c.type === 'GROUND');
  if (grounds.length > 0) {
    groundOriginalNode = pinToNode.get(grounds[0].pins[0].id);
  }

  if (groundOriginalNode === null && uniqueNodes.length > 0) {
    groundOriginalNode = uniqueNodes[0];
  }

  if (uniqueNodes.length <= 1) {
    return { nodeVoltages: {}, branchCurrents: {} };
  }

  const finalNodeMap = new Map();
  let mnaNodeIndex = 1;

  uniqueNodes.forEach(node => {
    if (node === groundOriginalNode) {
      finalNodeMap.set(node, 0);
    } else {
      finalNodeMap.set(node, mnaNodeIndex++);
    }
  });

  const numNodes = mnaNodeIndex - 1;
  let totalExtraVars = 0;
  const extraVarMap = new Map(); // comp.id -> array of indices

  components.forEach(c => {
    const model = registry.get(c.type);
    if (!model) return;
    const count = model.getExtraVariablesCount();
    if (count > 0) {
      const indices = [];
      for (let i = 0; i < count; i++) {
        indices.push(numNodes + totalExtraVars++);
      }
      extraVarMap.set(c.id, indices);
    }
  });

  const mnaSize = numNodes + totalExtraVars;
  if (mnaSize === 0) return { nodeVoltages: {}, branchCurrents: {} };

  const A = Array.from({ length: mnaSize }, () => new Array(mnaSize).fill(0));
  const Z = new Array(mnaSize).fill(0);

  const resolvedNodeMap = new Map();
  pinToNode.forEach((originalNode, pinId) => {
    resolvedNodeMap.set(pinId, finalNodeMap.get(originalNode));
  });

  components.forEach(c => {
    const model = registry.get(c.type);
    if (model) {
      model.applyMNA(A, Z, c, resolvedNodeMap, extraVarMap.get(c.id) || []);
    }
  });

  const X = solveLinearSystem(A, Z);

  const nodeVoltages = {};
  pinToNode.forEach((originalNode, pinId) => {
    const mnaNode = finalNodeMap.get(originalNode);
    if (mnaNode === 0) {
      nodeVoltages[pinId] = 0;
    } else {
      nodeVoltages[pinId] = X[mnaNode - 1];
    }
  });

  const branchCurrents = {};
  const getV = (pinId) => nodeVoltages[pinId] || 0;

  components.forEach(c => {
    const model = registry.get(c.type);
    if (model) {
      const extraVars = (extraVarMap.get(c.id) || []).map(idx => X[idx]);
      branchCurrents[c.id] = model.extractCurrent(c, nodeVoltages, extraVars);
    }
  });

  // Calculate actual current through wires.
  // In MNA, wires are ideal. To animate wires properly, they must carry current.
  // Since we haven't modeled each wire as a tiny resistor in MNA, we can approximate 
  // by associating the wire current with the current of the component connected to it.
  wires.forEach(w => {
    // Basic heuristic for visual feedback: If there's a non-zero voltage difference between 
    // nodes in the whole circuit, there's current. Let's just assign a blanket high/low current indicator
    // for animation if the connected components have current.
    let connectedComponentCurrent = 0;
    
    // Find a component connected to startPin
    components.forEach((c) => {
      if (c.pins.some(p => p.id === w.startPinId || p.id === w.endPinId)) {
        if (branchCurrents[c.id] !== undefined) {
          connectedComponentCurrent = Math.max(Math.abs(connectedComponentCurrent), Math.abs(branchCurrents[c.id]));
        }
      }
    });

    branchCurrents[w.id] = connectedComponentCurrent; 
  });

  return { nodeVoltages, branchCurrents };
}
