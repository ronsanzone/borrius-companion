import { ru16, ru32 } from "../vendor/binary.js";
import { fail } from "./errors";
export function sectionOffset(sections: Map<number, number>, id: number): number {
  const offset = sections.get(id);
  if (offset === undefined) fail(`missing section ${id}`);
  return offset;
}
const lengths = [0xadc, 0xff0, 0xff0, 0xff0, 0xd98, ...Array(8).fill(0xff4), 0x450];
function checksum(b: Uint8Array, off: number, len: number) {
  let total = 0;
  for (let i = 0; i < len; i += 4) total = (total + ru32(b, off + i)) >>> 0;
  return ((total >>> 16) + (total & 65535)) & 65535;
}
export function activeBank(b: Uint8Array) {
  const banks = [0, 14].map((start) =>
    Array.from({ length: 14 }, (_, i) => {
      const off = (start + i) * 4096;
      return {
        off,
        id: ru16(b, off + 0xff4),
        idx: ru32(b, off + 0xffc),
        signature: ru32(b, off + 0xff8),
      };
    }),
  );
  const candidates = banks.filter((bank) =>
    bank.some((s) => s.signature === 0x08012025 || s.signature === 0x01121999),
  );
  if (!candidates.length) fail("no recognized cartridge bank signature");
  // Counter wrap is deliberately unsupported rather than choosing stale progress.
  const counters = candidates
    .flat()
    .filter((s) => s.signature === 0x01121999 || s.signature === 0x08012025)
    .map((s) => s.idx);
  if (Math.max(...counters) - Math.min(...counters) > 0x7fffffff)
    fail("save counter wrap requires parser update");
  const latest = Math.max(...counters);
  const matches = candidates.filter((bank) => bank.some((s) => s.idx === latest));
  if (matches.length !== 1) fail("ambiguous active save bank");
  const bank = matches[0];
  if (
    bank.some((s) => s.idx !== latest || s.signature !== 0x01121999) ||
    new Set(bank.map((s) => s.id)).size !== 14 ||
    bank.some((s) => s.id > 13)
  )
    fail("incomplete active bank; save again after the game finishes writing");
  for (const s of bank)
    if (checksum(b, s.off, lengths[s.id]) !== ru16(b, s.off + 0xff6))
      fail(`section ${s.id} checksum mismatch`);
  return new Map(bank.map((s) => [s.id, s.off]));
}
