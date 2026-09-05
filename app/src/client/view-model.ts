import type { AppState, Pairing } from "./contracts";
import type { Pokemon, Snapshot } from "../shared/types";
/** A render snapshot: feature views cannot mutate the application controller. */
export interface ViewModel {
  readonly state: AppState;
  readonly selected: readonly string[];
  readonly inverse: boolean;
  readonly limit: number;
  readonly hard: boolean;
  readonly query: string;
  readonly scope: string;
  readonly compare: Snapshot | null;
  readonly pair: Pairing | null;
  readonly activePlan: string | null;
  readonly shortlist: readonly string[];
  readonly focusBoard: boolean;
  readonly swapIn: string | null;
  readonly draftName: string;
  readonly lastCounts: Record<string, number> | null;
  readonly plannerMessage: string;
  readonly owned: () => Pokemon[];
  readonly team: () => Pokemon[];
  readonly planningRoster: () => Pokemon[];
}
