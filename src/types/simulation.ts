// ─── Primitives ───

export interface Vector2D {
  x: number;
  y: number;
}

// ─── Body State ───

export type BodyId = 'r' | 'g' | 'b';

export interface BodyState {
  id: BodyId;
  mass: number;
  position: Vector2D;
  velocity: Vector2D;
}

export interface BodyDerived {
  speed: number;                    // |v|
  acceleration: Vector2D;          // current gravitational acceleration
  kineticEnergy: number;           // 0.5 * m * v^2
}

// ─── System State ───

export interface GlobalConfig {
  G: number;                        // Gravitational constant
  softening: number;                // Softening parameter (ε)
  trailLength: number;              // Frames of trail history
}

export interface SimulationState {
  bodies: [BodyState, BodyState, BodyState];   // Always exactly 3: [R, G, B]
  globals: GlobalConfig;
  time: number;                     // Simulation clock (t)
}

// ─── Derived System Values ───

export interface PairwiseValues {
  rg: number;                       // Between Body R and Body G
  rb: number;                       // Between Body R and Body B
  gb: number;                       // Between Body G and Body B
}

export interface SystemDerived {
  bodyDerived: [BodyDerived, BodyDerived, BodyDerived];
  distances: PairwiseValues;                 // Pairwise distances
  potentialEnergies: PairwiseValues;         // Pairwise PE
  totalEnergy: number;                       // Sum KE + Sum PE
  angularMomentum: number;                   // System total L
  centerOfMass: Vector2D;                    // Weighted average position
  totalMomentum: Vector2D;                   // Sum of m*v
}

// ─── Collision Events ───

export type BodyPair = 'rg' | 'rb' | 'gb';

export interface CollisionEvent {
  pair: BodyPair;
  point: Vector2D;                  // Midpoint of collision
  relativeSpeed: number;            // Speed of approach
  timestamp: number;                // Simulation time
}

// ─── Trail Data ───

export interface TrailPoint {
  position: Vector2D;
  timestamp: number;
}

export type TrailHistory = [TrailPoint[], TrailPoint[], TrailPoint[]]; // [R, G, B]
