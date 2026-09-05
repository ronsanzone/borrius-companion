import type { CatalogSpecies } from '../shared/types';
interface Species extends CatalogSpecies { growthRate: number; abilities: { ability_1_id: number; ability_2_id: number; hidden_ability_id: number }; }
declare const data: { species: Record<number, Species>; moves: Record<number, { name: string; basePp: number }>; abilities: Record<number, string>; items: Record<number, string> };
export default data;
