import type { TeamMember, Pokemon } from "./types";
export function ownedIds(members: readonly TeamMember[]): string[] {
  return members.flatMap((member) => (member.kind === "owned" ? [member.pokemonId] : []));
}
export function editTeam(
  members: readonly TeamMember[],
  member: TeamMember,
  replace?: number,
): readonly TeamMember[] {
  if (
    member.kind === "owned" &&
    members.some((m, i) => i !== replace && m.kind === "owned" && m.pokemonId === member.pokemonId)
  )
    throw Error("That individual is already on your team.");
  if (replace !== undefined) {
    if (!Number.isInteger(replace) || replace < 0 || replace >= members.length)
      throw Error("Choose a current slot to replace.");
    return members.map((m, i) => (i === replace ? member : m));
  }
  if (members.length >= 6) throw Error("Your team has six members. Choose a slot to replace.");
  return [...members, member];
}
export function resolveOwned(member: TeamMember, owned: readonly Pokemon[]): Pokemon | undefined {
  return member.kind === "owned" ? owned.find((p) => p.id === member.pokemonId) : undefined;
}
