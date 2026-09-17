"use client";

import HopToGoalGame from "./hop-to-goal-game";
import RocketLaunchGame from "./rocket-launch-game";

type Props = {
  type: string;
  stepCount: number;
  onLevelCleared?: () => void;
};

/** Maps a reinforcement board's `type` column to its mini-game
 *  component. Falls back to hop_to_goal for any value it doesn't
 *  recognize (e.g. a board saved by a future version of the app with a
 *  template that isn't in this build yet), since `type` is a
 *  free-form-ish key stored in the database rather than something the
 *  schema itself constrains. */
export default function ReinforcementGamePlayer({
  type,
  stepCount,
  onLevelCleared,
}: Props) {
  if (type === "rocket_launch") {
    return (
      <RocketLaunchGame stepCount={stepCount} onLevelCleared={onLevelCleared} />
    );
  }
  return (
    <HopToGoalGame stepCount={stepCount} onLevelCleared={onLevelCleared} />
  );
}
