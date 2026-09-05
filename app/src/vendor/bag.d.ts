export function resolveQuickPockets(bytes: Uint8Array): { main?: { anchor_offset: number } };
export function mapPocketFromAnchor(bytes: Uint8Array, offset: number, names: Map<number, string>): { id: number; qty: number }[];
export function collectOwnedTmhmItemIds(bytes: Uint8Array): { owned_tmhm_item_ids: number[] };
