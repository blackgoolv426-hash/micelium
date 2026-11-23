import { SimulationParams } from '../types/simulation';

export interface ISimulationEngine {
  resize(width: number, height: number, params: SimulationParams): void;
  setImageGuide(guideRGB: Uint8Array | null, luminance?: Uint8Array | null): void;
  setSecondImageGuide(guideRGB: Uint8Array | null, luminance?: Uint8Array | null): void;
  setThirdImageGuide(guideRGB: Uint8Array | null, luminance?: Uint8Array | null): void;
  resetSimulation(params: SimulationParams): void;
  step(params: SimulationParams, substeps?: number): void;
  render(params: SimulationParams): void;
  destroy(): void;
  getStepCount(): number;
  getTargetSteps(params: SimulationParams): number;
  getGrowthProgress(params: SimulationParams): number;
  getActiveCount(): number;
}
