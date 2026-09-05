/** Synthetic cartridge save: no ROM or private gameplay data required. */
const lens = [0xadc, 0xff0, 0xff0, 0xff0, 0xd98, ...Array(8).fill(0xff4), 0x450];
export function repair(b: Buffer, id: number) {
  const o = id * 4096;
  let sum = 0;
  for (let i = 0; i < lens[id]; i += 4) sum = (sum + b.readUInt32LE(o + i)) >>> 0;
  b.writeUInt16LE(((sum >>> 16) + (sum & 65535)) & 65535, o + 0xff6);
}
export function fixture({ fullRoster = false } = {}) {
  const b = Buffer.alloc(131072);
  for (let id = 0; id < 14; id++) {
    const o = id * 4096;
    b.writeUInt16LE(id, o + 0xff4);
    b.writeUInt32LE(0x01121999, o + 0xff8);
    b.writeUInt32LE(8, o + 0xffc);
  }
  const t = 4096;
  b.writeUInt32LE(1, t + 0x34);
  const o = t + 0x38;
  b.writeUInt32LE(123, o);
  b.writeUInt32LE(789, o + 4);
  b[o + 8] = 0xff;
  b.writeUInt16LE(1, o + 0x20);
  b.writeUInt32LE(135, o + 0x24);
  b[o + 0x54] = 5;
  b.writeUInt16LE(20, o + 0x56);
  b.writeUInt16LE(20, o + 0x58);
  if (fullRoster) {
    b.writeUInt32LE(6, t + 0x34);
    const species = [1, 4, 7, 25, 35, 74];
    for (let slot = 0; slot < 6; slot++) {
      const offset = o + slot * 100;
      if (slot > 0) b.copy(b, offset, o, o + 100);
      b.writeUInt32LE(123 + slot, offset);
      b.writeUInt16LE(species[slot], offset + 0x20);
      b.writeUInt16LE(33, offset + 0x2c);
      b[offset + 0x34] = 10;
    }
    for (let slot = 0; slot < 4; slot++) {
      const offset = 5 * 4096 + 4 + slot * 58;
      b.writeUInt32LE(200 + slot, offset);
      b.writeUInt32LE(789, offset + 4);
      b[offset + 8] = 0xff;
      b.writeUInt16LE([10, 16, 27, 92][slot], offset + 0x1c);
      b.writeUInt32LE(135, offset + 0x20);
      b[offset + 0x27] = 33;
    }
  }
  for (let id = 0; id < 14; id++) repair(b, id);
  return b;
}
