/** The two starting mini-game templates for the Reinforcement Bank
 *  (see 0038_reinforcement_boards.sql). A board's `type` column stores
 *  one of these values; ReinforcementGamePlayer
 *  (src/components/reinforcement-games/reinforcement-game-player.tsx)
 *  is the single place that maps a value to its component, so adding a
 *  third template later only means adding one entry here plus one
 *  component. */
export type ReinforcementGameType = "hop_to_goal" | "rocket_launch";

export const REINFORCEMENT_GAME_TYPES: {
  value: ReinforcementGameType;
  label: string;
  description: string;
}[] = [
  {
    value: "hop_to_goal",
    label: "Hop to the Goal",
    description:
      "A friendly critter hops over obstacles toward a flag, then celebrates.",
  },
  {
    value: "rocket_launch",
    label: "Rocket Launch",
    description:
      "A rocket climbs past a field of stars toward a planet, then celebrates.",
  },
];

export const REINFORCEMENT_GAME_LABELS: Record<ReinforcementGameType, string> =
  Object.fromEntries(
    REINFORCEMENT_GAME_TYPES.map((t) => [t.value, t.label])
  ) as Record<ReinforcementGameType, string>;

export const MIN_STEP_COUNT = 1;
export const MAX_STEP_COUNT = 12;
export const DEFAULT_STEP_COUNT = 5;

export function isReinforcementGameType(
  value: string
): value is ReinforcementGameType {
  return REINFORCEMENT_GAME_TYPES.some((t) => t.value === value);
}
