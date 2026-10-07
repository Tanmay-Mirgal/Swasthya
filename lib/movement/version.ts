/**
 * Version of the movement engine's judging rules. Stored with every chunk so that numbers
 * produced by different rule sets are never silently compared (v1 = the legacy tempo-based
 * form score; v2 = per-rep validity from the template engine;
 * v3 = v2 plus an outcome and an attempt record for every cycle, `uncertain` reps, and unmeasurable rules reported;
 * v4 = GOOD reps only: a rep that is flagged or falls short is NOT counted and never credits the prescription, so a chunk's
 * `reps` are its valid reps and the attempts that did not count are stored beside them).
 */
export const ENGINE_VERSION = 4;
