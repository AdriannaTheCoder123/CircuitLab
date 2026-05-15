export type ComponentType = 'battery' | 'resistor' | 'bulb' | 'switch' | 'wire' | 'voltmeter' | 'ammeter' | 'fuse' | 'ground';
export type ViewMode = 'realistic' | 'schematic';

export interface Point {
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  value: number; // Voltage for battery, Ohms for resistor/bulb
  label: string;
  pos1: Point; // Grid coordinates
  pos2: Point;
  state?: boolean; // For switch: true = closed, false = open; For fuse: true = blown
}

export interface NodeState {
  voltage: number;
  id: string;
}

export interface SimulationResult {
  components: {
    id: string;
    current: number;
    voltageDrop: number;
    power: number;
  }[];
  nodes: {
    [key: string]: number; // node key (x,y) -> voltage
  };
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  check: (components: CircuitComponent[], result: SimulationResult | null) => boolean;
}
