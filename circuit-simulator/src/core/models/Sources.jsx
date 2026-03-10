import BaseComponent from './BaseComponent';
import React from 'react';

export class DcVoltageSourceModel extends BaseComponent {
  get type() { return 'DC_VOLTAGE_SOURCE'; }
  get label() { return 'DC Voltage'; }
  get category() { return 'Sources'; }
  get numPins() { return 2; }
  get defaultProperties() { return { voltage: 9 }; }
  get propertyLabels() { return { voltage: 'Voltage (V)' }; }
  get color() { return '#3b82f6'; }

  getExtraVariablesCount() {
    return 1; // Needs 1 branch current constraint
  }

  applyMNA(A, Z, componentState, finalNodeMap, extraVarIndices) {
    const v = componentState.properties.voltage || 9;
    const nPlus = finalNodeMap.get(componentState.pins[0].id) || 0; 
    const nMinus = finalNodeMap.get(componentState.pins[1].id) || 0;
    const vsEqIndex = extraVarIndices[0];

    // Branch current equation mapping
    if (nPlus > 0) A[nPlus - 1][vsEqIndex] += 1;
    if (nMinus > 0) A[nMinus - 1][vsEqIndex] -= 1;
    if (nPlus > 0) A[vsEqIndex][nPlus - 1] += 1;
    if (nMinus > 0) A[vsEqIndex][nMinus - 1] -= 1;

    Z[vsEqIndex] = v;
  }

  extractCurrent(componentState, nodeVoltages, extraVarValues) {
    return extraVarValues[0] || 0;
  }

  renderShape() {
    return (
      <g>
        <line x1="-30" y1="0" x2="-10" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="10" y1="0" x2="30" y2="0" stroke={this.color} strokeWidth="3" />
        <line x1="-10" y1="-15" x2="-10" y2="15" stroke={this.color} strokeWidth="3" />
        <line x1="10" y1="-8" x2="10" y2="8" stroke={this.color} strokeWidth="5" />
        <text x="-25" y="-12" fill={this.color} fontSize="14" fontWeight="bold" textAnchor="middle">+</text>
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke={this.color}>
        <line x1="-30" y1="0" x2="-10" y2="0" strokeWidth="4" />
        <line x1="10" y1="0" x2="30" y2="0" strokeWidth="4" />
        <line x1="-10" y1="-20" x2="-10" y2="20" strokeWidth="4" />
        <line x1="10" y1="-10" x2="10" y2="10" strokeWidth="6" />
      </g>
    );
  }
}

export class GroundModel extends BaseComponent {
  get type() { return 'GROUND'; }
  get label() { return 'Ground'; }
  get category() { return 'Sources'; }
  get numPins() { return 1; }
  get color() { return '#10b981'; }

  // Ground doesn't apply math via stamp directly,
  // The system merges all grounds into node 0.
  applyMNA() {}
  
  extractCurrent() { return 0; }

  renderShape() {
    return (
      <g>
        <line x1="0" y1="0" x2="0" y2="15" stroke={this.color} strokeWidth="3" />
        <line x1="-15" y1="15" x2="15" y2="15" stroke={this.color} strokeWidth="3" />
        <line x1="-10" y1="20" x2="10" y2="20" stroke={this.color} strokeWidth="3" />
        <line x1="-5" y1="25" x2="5" y2="25" stroke={this.color} strokeWidth="3" />
      </g>
    );
  }

  renderIcon() {
    return (
      <g stroke={this.color} transform="translate(0, -15)">
        <line x1="0" y1="0" x2="0" y2="20" strokeWidth="4" />
        <line x1="-20" y1="20" x2="20" y2="20" strokeWidth="4" />
        <line x1="-12" y1="28" x2="12" y2="28" strokeWidth="4" />
        <line x1="-5" y1="36" x2="5" y2="36" strokeWidth="4" />
      </g>
    );
  }
}
