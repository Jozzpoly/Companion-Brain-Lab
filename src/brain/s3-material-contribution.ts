import type { S2SituatedResponsibilityDecision } from "./situated-responsibility";
import type {
  SharedDangerRules,
  WorldActionAttempt
} from "../world/shared-danger-contract";
import type { MotionIntent, WorldSnapshot } from "../world/types";

export type S3MaterialContributionKind =
  | "NONE"
  | "APPROACH_INTERVENTION"
  | "INTERVENE";

export interface S3MaterialContributionProposal {
  kind: S3MaterialContributionKind;
  motionIntent: MotionIntent;
  actionAttempt: WorldActionAttempt | null;
  focusId: "hostile" | null;
  distanceToFocus: number | null;
  reason: string;
}

function zero(reason: string): S3MaterialContributionProposal {
  return {
    kind: "NONE",
    motionIntent: {
      actorId: "companion",
      move: { x: 0, y: 0 }
    },
    actionAttempt: null,
    focusId: null,
    distanceToFocus: null,
    reason
  };
}

export function proposeS3MaterialContribution(input: {
  snapshot: WorldSnapshot;
  responsibility: S2SituatedResponsibilityDecision | null;
  rules: SharedDangerRules;
}): S3MaterialContributionProposal {
  const responsibility = input.responsibility;
  if (!responsibility || responsibility.responsibility !== "OWNED") {
    return zero(
      responsibility
        ? `S2 responsibility is ${responsibility.responsibility}; S3 has no authority to contribute`
        : "S2 responsibility is unavailable; S3 has no authority to contribute"
    );
  }

  if (responsibility.focusId !== "hostile") {
    throw new Error("S3 OWNED responsibility requires the bounded hostile focus.");
  }

  const companion = input.snapshot.actors.find((actor) => actor.id === "companion");
  const hostile = input.snapshot.actors.find((actor) => actor.id === "hostile");
  if (!companion || !hostile) {
    throw new Error("S3 material contribution requires companion and hostile World bodies.");
  }

  const dx = hostile.position.x - companion.position.x;
  const dy = hostile.position.y - companion.position.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= input.rules.interventionRange + 1e-9) {
    return {
      kind: "INTERVENE",
      motionIntent: {
        actorId: "companion",
        move: { x: 0, y: 0 }
      },
      actionAttempt: {
        actorId: "companion",
        kind: "INTERVENE",
        targetId: "hostile"
      },
      focusId: "hostile",
      distanceToFocus: distance,
      reason:
        "S2 owns responsibility and the companion is already inside the authoritative intervention range; submit one material World action"
    };
  }

  const invDistance = distance > 1e-9 ? 1 / distance : 0;
  return {
    kind: "APPROACH_INTERVENTION",
    motionIntent: {
      actorId: "companion",
      move: {
        x: dx * invDistance,
        y: dy * invDistance
      }
    },
    actionAttempt: null,
    focusId: "hostile",
    distanceToFocus: distance,
    reason:
      "S2 owns responsibility but the companion is outside intervention range; use a provisional open-field approach only to realize the already-earned responsibility"
  };
}
