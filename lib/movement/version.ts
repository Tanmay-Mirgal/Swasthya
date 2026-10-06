/**
 * Version of the movement engine's judging rules. Stored with every chunk so that numbers
 * produced by different rule sets are never silently compared (v1 = the legacy tempo-based
 * form score; v2 = per-rep validity from the template engine).
 */
export const ENGINE_VERSION = 2;
