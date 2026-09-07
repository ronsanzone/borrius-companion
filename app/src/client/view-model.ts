import type { AppState, Pairing } from "./contracts";
import type { Pokemon, Snapshot } from "../shared/types";
/** Immutable render input for companion views. Strategy draft has one controller owner. */
export interface ViewModel {
  readonly state: AppState;
  readonly selected: readonly string[];
  readonly compare: Snapshot | null;
  readonly pair: Pairing | null;
  readonly owned: () => Pokemon[];
}
