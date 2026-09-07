import type { Dex } from "./dex-data";
import type { TeamMember, Pokemon, Combatant, Move } from "../../shared/types";
import { resolveOwned } from "../../shared/team";
export function memberView(member: TeamMember, owned: readonly Pokemon[], dex: Dex) {
  const individual = resolveOwned(member, owned);
  const species = dex.species.find(
    (s) => s.speciesId === (member.kind === "build" ? member.speciesId : individual?.speciesId),
  );
  const proposed =
    member.kind === "build"
      ? member.moveIds.flatMap<Move>((id) =>
          id !== null && dex.moves[id]
            ? [dex.moves[id]]
            : [{ name: "Unspecified move slot", type: null, category: null, power: null }],
        )
      : [];
  const combatant: Combatant = individual ?? { types: species?.types ?? [], moves: proposed };
  return {
    individual,
    species,
    proposed,
    combatant,
    name:
      individual?.nickname ||
      individual?.name ||
      species?.name ||
      (member.kind === "owned" ? "Missing owned individual" : "Unknown form"),
    missing: member.kind === "owned" && !individual,
  };
}
