/** Audited progression evidence: individual walkthrough chapters, reviewed 2026-09-07.
 * Stable roster IDs survive the migration; rival branches are one selectable event.
 * Positions order events within a chapter. League members share player-order position.
 */
export interface Encounter {
  id: string;
  chapter: number;
  position: number;
  group: "story" | "player-order" | "postgame" | "optional";
  evidence: string;
  stages: readonly string[];
  starter: boolean;
  name?: string;
  gap?: string;
}
const event = (
  id: string,
  chapter: number,
  position = 1,
  stages: readonly string[] = [id],
  group: Encounter["group"] = "story",
): Encounter => ({
  id,
  chapter,
  position,
  stages,
  group,
  starter: id.startsWith("rival-"),
  evidence: `https://unboundwiki.com/walkthrough/part-${chapter}/`,
});
export const encounters: readonly Encounter[] = [
  event("rival-1", 1),
  event("rival-2", 2),
  event("gym-mirskle", 4),
  event("shadow-1", 5),
  event("gym-vega", 7),
  event("shadow-2", 7, 2),
  event("shadow-3", 7, 3),
  event("rival-3", 9),
  event("gym-alice", 10),
  event("shadow-4", 13),
  event("wild-1", 13, 2),
  event("gym-mel", 14),
  event("shadow-5", 15),
  event("boss-maxima", 16),
  event("rival-4", 17),
  event("wild-2", 18),
  event("void-beasts", 18, 2, ["wild-3", "wild-4", "wild-5"]),
  event("void-birds", 18, 3, ["wild-6", "wild-7"]),
  event("light-1", 19),
  event("wild-8", 19, 2),
  event("shadow-6", 19, 3),
  event("gym-galavan", 20),
  event("wild-9", 25),
  event("wild-10", 25, 2),
  event("light-2", 26),
  event("gym-big-mo", 29),
  event("gym-tessy", 33),
  event("rival-5", 35),
  event("wild-11", 35, 2),
  event("light-3", 35, 3),
  event("peak-finale", 35, 4, ["wild-12", "wild-13"]),
  event("light-4", 35, 5),
  event("shadow-7", 35, 6),
  event("gym-benjamin", 36),
  ...[1, 2, 3, 4].map((n) => event(`league-${n}`, 39, 1, [`league-${n}`], "player-order")),
  event("league-5", 39, 2),
  {
    ...event("postgame-claydol", 40, 1, ["postgame-claydol"], "postgame"),
    name: "Dynamax Claydol · submerged Ruins of Void",
    gap: "Walkthrough establishes this boss before the final Aklove fight. No versioned exact-difficulty set is established.",
  },
  event("light-5", 40, 2, ["light-5"], "postgame"),
  ...[
    { id: "mission-071", name: "The Rogue Electivire", chapter: 23 },
    { id: "mission-051", name: "Protector of the Swamp · Dynamax Feraligatr", chapter: 34 },
    { id: "mission-060", name: "The Battle of Antisis", chapter: 28 },
  ].map((item) => ({
    ...event(item.id, item.chapter, 1, [item.id], "optional"),
    name: item.name,
    evidence: `https://unboundwiki.com/missions/${item.id}/`,
    gap: "Optional mission; player chooses when to complete it. Versioned difficulty-specific boss rosters and stages remain unverified.",
  })),
  ...[
    { id: "mission-004", name: "A Rift in Space" },
    { id: "mission-054", name: "Shark Bait" },
    { id: "mission-066", name: "The Endless Nightmare" },
    { id: "mission-072", name: "The Strongest There Is · developer trainers" },
    { id: "mission-025", name: "Gimme a V · Classic Leaders Gauntlet" },
    { id: "mission-076", name: "Tomb Raider" },
  ].map((item) => ({
    ...event(item.id, 40, 3, [item.id], "postgame"),
    name: item.name,
    evidence: `https://unboundwiki.com/missions/${item.id}/`,
    gap: "Named postgame content; no mandatory order is asserted. Exact roster coverage remains unverified.",
  })),
];
export function encounterForRoster(id: string | null): Encounter | undefined {
  return encounters.find(
    (e) => e.stages.includes(id ?? "") || (e.starter && id?.startsWith(e.id + "-")),
  );
}
export function rosterId(event: Encounter, stage: number, starter: string): string | undefined {
  if (event.starter)
    return ["gible", "beldum", "larvitar"].includes(starter) ? `${event.id}-${starter}` : undefined;
  return event.stages[stage];
}
