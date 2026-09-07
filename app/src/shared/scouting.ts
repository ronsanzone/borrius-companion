import type { Move } from "./types";
import { hasOrdinaryTypeDamage } from "./domain";
/** Reference heuristics, not combat stat estimates. Stat order follows the pinned Dex. */
export function scout(base: readonly number[], moves: readonly Move[]) {
  if (base.length !== 6 || base.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const [hp, atk, def, spa, spd, spe] = base;
  const physical = moves.filter(
    (m) => hasOrdinaryTypeDamage(m) && m.category?.toLowerCase() === "physical",
  ).length;
  const special = moves.filter(
    (m) => hasOrdinaryTypeDamage(m) && m.category?.toLowerCase() === "special",
  ).length;
  const support = moves.filter((m) => m.category?.toLowerCase() === "status");
  const recovery = support.filter((m) =>
    /^(recover|roost|slack off|soft[ -]?boiled|milk drink|wish|rest|synthesis|moonlight|morning sun|strength sap|shore up|heal order)$/i.test(
      m.name ?? "",
    ),
  );
  const physicalBulk = hp * def,
    specialBulk = hp * spd;
  const bulky = physicalBulk >= 9000 || specialBulk >= 9000;
  return {
    speed: spe >= 100 ? "Fast" : spe < 60 ? "Slow" : "Mid-speed",
    offense:
      physical && special
        ? "Mixed offense"
        : physical
          ? "Physical offense"
          : special
            ? "Special offense"
            : "Offense unknown",
    role:
      bulky && recovery.length
        ? "Wall potential"
        : bulky && (physical || special)
          ? "Tank potential"
          : support.length >= 2
            ? "Support potential"
            : "Role uncertain",
    evidence: [
      `Base Speed ${spe}: fast ≥100, slow <60; turn order depends on levels, moves and battle rules.`,
      `${physical} documented physical and ${special} special ordinary attacks; base Attack ${atk}, Sp. Atk ${spa}.`,
      `Physical bulk index HP × Defense = ${physicalBulk}; special bulk index HP × Sp. Def = ${specialBulk}. ≥9000 indicates stronger reference bulk.`,
      `Recovery: ${recovery.map((m) => m.name).join(", ") || "not documented"}. Support: ${support.map((m) => m.name).join(", ") || "not documented"}. Bulk alone does not establish a wall.`,
    ],
  };
}
