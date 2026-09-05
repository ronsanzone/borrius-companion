export function fail(message: string): never {
  throw new Error(`Unsupported or corrupt save: ${message}`);
}
