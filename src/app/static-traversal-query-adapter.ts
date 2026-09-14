import type { StaticTraversalQuery } from "../navigation/static-router";
import type { LabWorld } from "../world/world";

/**
 * Preserve the complete route/local-movement traversal contract at the app
 * boundary. In particular, `initialOverlap: "allow-egress"` must survive the
 * scene -> brain -> World adapter instead of being silently dropped by a
 * three-argument closure.
 */
export function bindWorldStaticTraversalQuery(
  world: Pick<LabWorld, "staticCircleTraversal">
): StaticTraversalQuery {
  return (from, to, radius, options) =>
    world.staticCircleTraversal(from, to, radius, options);
}
