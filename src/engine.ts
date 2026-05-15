import { CircuitComponent, SimulationResult } from './types';

export function solveCircuit(components: CircuitComponent[]): SimulationResult {
  // 1. Identify unique nodes
  const nodes = new Map<string, string>(); // "x,y" -> nodeId
  let nodeCount = 0;
  
  const getNodeKey = (pos: { x: number; y: number }) => `${pos.x},${pos.y}`;

  components.forEach(c => {
    [c.pos1, c.pos2].forEach(pos => {
      const key = getNodeKey(pos);
      if (!nodes.has(key)) {
        nodes.set(key, `n${nodeCount++}`);
      }
    });
  });

  const nodeIds = Array.from(nodes.values());
  const voltages: Record<string, number> = {};
  nodeIds.forEach(id => voltages[id] = 0);

  // 2. Set Boundary Conditions (Batteries)
  // Simple assumption for now: First battery found defines the reference
  const battery = components.find(c => c.type === 'battery');
  if (!battery) {
    return { components: components.map(c => ({ id: c.id, current: 0, voltageDrop: 0, power: 0 })), nodes: {} };
  }

  const posNode = nodes.get(getNodeKey(battery.pos1))!;
  const negNode = nodes.get(getNodeKey(battery.pos2))!;
  
  // 3. Iterative Solver (Relaxation)
  const iterations = 100;
  
  // Pre-identify ground nodes
  const groundNodes = new Set<string>();
  components.forEach(c => {
    if (c.type === 'ground') {
      groundNodes.add(nodes.get(getNodeKey(c.pos1))!);
      groundNodes.add(nodes.get(getNodeKey(c.pos2))!);
    }
  });

  for (let i = 0; i < iterations; i++) {
    // Force battery nodes
    voltages[posNode] = battery.value;
    voltages[negNode] = 0;
    
    // Force ground nodes
    groundNodes.forEach(nid => voltages[nid] = 0);

    nodeIds.forEach(nodeId => {
      if (nodeId === posNode || nodeId === negNode || groundNodes.has(nodeId)) return;

      let sumGV = 0;
      let sumG = 0;

      components.forEach(c => {
        // Only if component is not a battery (batteries are our boundary conditions)
        if (c.type === 'battery') return;
        // If switch is open, or fuse is blown, conductance is 0
        const isFuseBlown = c.type === 'fuse' && (c.state === true); // state: true = blown
        if ((c.type === 'switch' && c.state === false) || isFuseBlown) return;

        const n1 = nodes.get(getNodeKey(c.pos1))!;
        const n2 = nodes.get(getNodeKey(c.pos2))!;

        if (n1 === nodeId || n2 === nodeId) {
          const otherNode = n1 === nodeId ? n2 : n1;
          
          let resistance = 0.001;
          if (c.type === 'resistor' || c.type === 'bulb') {
            resistance = c.value;
          } else if (c.type === 'voltmeter') {
            resistance = 1000000; // 1M Ohm
          } else if (c.type === 'ammeter') {
            resistance = 0.0001; // Extremely low
          } else if (c.type === 'fuse') {
            resistance = 0.001;
          }

          const conductance = 1 / resistance;
          
          sumGV += conductance * voltages[otherNode];
          sumG += conductance;
        }
      });

      if (sumG > 0) {
        voltages[nodeId] = sumGV / sumG;
      }
    });
  }

  // Helper to get consistent resistance
  const getResistance = (c: CircuitComponent) => {
    if (c.type === 'resistor' || c.type === 'bulb') return c.value;
    if (c.type === 'voltmeter') return 1000000;
    if (c.type === 'ammeter') return 0.0001;
    if (c.type === 'wire') return 0.001;
    if (c.type === 'battery') return 0.001;
    if (c.type === 'switch') return c.state ? 0.001 : Infinity;
    if (c.type === 'fuse') return c.state ? Infinity : 0.001;
    if (c.type === 'ground') return 0.001;
    return 0.001;
  };

  // 4. Calculate stats for each component
  const results = components.map(c => {
    const n1 = nodes.get(getNodeKey(c.pos1))!;
    const n2 = nodes.get(getNodeKey(c.pos2))!;
    const v1 = voltages[n1];
    const v2 = voltages[n2];
    const voltageDrop = Math.abs(v1 - v2);
    
    let current = 0;
    if (c.type === 'battery') {
        current = 0; 
    } else {
        const resistance = getResistance(c);
        if (resistance !== Infinity) {
            current = voltageDrop / resistance;
        }
    }

    return {
      id: c.id,
      current,
      voltageDrop,
      power: current * voltageDrop
    };
  });

  // Rough estimation for battery current (sum of outputs)
  results.forEach((r, idx) => {
      if (components[idx].type === 'battery') {
          // Find all components connected to node1 of battery
          const n1 = nodes.get(getNodeKey(components[idx].pos1))!;
          let totalI = 0;
          components.forEach((c2, idx2) => {
              if (c2.id === r.id) return;
              const cn1 = nodes.get(getNodeKey(c2.pos1))!;
              const cn2 = nodes.get(getNodeKey(c2.pos2))!;
              if (cn1 === n1 || cn2 === n1) {
                  totalI += results[idx2].current;
              }
          });
          r.current = totalI;
      }
  });

  // Convert node IDs back to coordinate keys for UI
  const nodeVoltages: Record<string, number> = {};
  nodes.forEach((id, key) => {
    nodeVoltages[key] = voltages[id];
  });

  return {
    components: results,
    nodes: nodeVoltages
  };
}
