import { registry } from './ComponentRegistry';
import { ResistorModel, SwitchModel, BulbModel } from './models/ResistorBased.jsx';
import { DcVoltageSourceModel, GroundModel } from './models/Sources.jsx';
import { DiodeModel, LedModel } from './models/Semiconductors.jsx';

// Register core models
registry.register(new ResistorModel());
registry.register(new SwitchModel());
registry.register(new BulbModel());
registry.register(new DcVoltageSourceModel());
registry.register(new GroundModel());
registry.register(new DiodeModel());
registry.register(new LedModel());

// Export types dynamically for backwards compatibility
export const COMPONENT_TYPES = {};
export const COMPONENT_DEFINITIONS = {};

registry.getAll().forEach(model => {
  COMPONENT_TYPES[model.type] = model.type;
  
  // Maintain backward compatibility shape for the Reducer/ComponentDef factory
  COMPONENT_DEFINITIONS[model.type] = {
    type: model.type,
    label: model.label,
    category: model.category,
    numPins: model.numPins,
    defaultProperties: model.defaultProperties,
    propertyLabels: model.propertyLabels,
    propertyMeta: model.propertyMeta,
    color: model.color,
  };
});

// Provide a global way to get the registry if needed
export { registry };

export function createComponent(type, x, y) {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown component type: ${type}`);
  
  return {
    id: `comp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    type,
    x,
    y,
    rotation: 0,
    properties: { ...def.defaultProperties },
    pins: Array.from({ length: def.numPins }).map((_, i) => ({
      id: `pin_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
      index: i,
      // For rendering, pin relative offsets:
      offsetX: def.numPins === 1 ? 0 : (i === 0 ? -30 : 30),
      offsetY: 0
    }))
  };
}

export function createWire(startPinId, endPinId) {
  return {
    id: `wire_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    startPinId,
    endPinId,
    path: [] 
  };
}

