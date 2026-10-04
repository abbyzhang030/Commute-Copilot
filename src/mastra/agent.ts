import { Interpretation } from "../types.js";
import { interpretKeywords } from "../interpret.js";

/**
 * Coordinator intent adapter.
 *
 * The merged local project deliberately uses the deterministic keyword
 * interpreter so it runs without API keys or external model services. A future
 * model-backed adapter can implement this same function without changing the
 * planner or API routes.
 */
export const COORDINATOR_INSTRUCTIONS = `Interpret voice feedback for an adaptive commute coordinator.
Return only changes the driver actually requested. Treat changes as temporary
unless the driver explicitly says always, from now on, or never again.`;

export const llmEnabled = () => false;

export async function interpretUtterance(
  text: string,
  _context: Record<string, unknown>,
): Promise<{ result: Interpretation; via: "keywords" }> {
  return { result: interpretKeywords(text), via: "keywords" };
}
