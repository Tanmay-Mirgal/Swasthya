/**
 * lib/movement/template/registry.ts
 *
 * Every exercise the movement engine can judge. An exercise is prescribable and
 * trackable if and only if it is registered here.
 */
import type { MovementTemplate } from "./schema";
import { seatedKneeExtension } from "./templates/seatedKneeExtension";
import { seatedBicepCurl } from "./templates/seatedBicepCurl";
import { neckRotation } from "./templates/neckRotation";
import { sitToStand } from "./templates/sitToStand";
import { shoulderAbduction } from "./templates/shoulderAbduction";
import { heelRaise } from "./templates/heelRaise";
import { miniSquat } from "./templates/miniSquat";

const ALL: MovementTemplate[] = [seatedKneeExtension, seatedBicepCurl, neckRotation, sitToStand, shoulderAbduction, heelRaise, miniSquat];

const BY_ID = new Map(ALL.map((t) => [t.id, t]));

export function getMovementTemplate(id: string): MovementTemplate | null {
  return BY_ID.get(id) ?? null;
}

export function getAllMovementTemplates(): readonly MovementTemplate[] {
  return ALL;
}
