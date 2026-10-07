import type { MovementUi } from "@/lib/movement/ui/movementUi";
import type { LanguageCode } from "./languages";
import { localizeShown } from "./spoken";

/**
 * The coach's words in `ui`, in the chosen language. The engine and the coach only ever produce English text and
 * facts; this is the one place on the way to the screen where that text is translated, with the same catalogue the
 * voice uses. Everything else in `ui` (counts, phases, joints) is language-free and passed through untouched.
 * English returns the same object, so nothing is copied while the default language is in use.
 */
export function localizeMovementUi(ui: MovementUi, lang: LanguageCode): MovementUi {
  if (lang === "en") return ui;
  const say = (text: string) => localizeShown(text, lang);
  const v = ui.verdict;
  return {
    ...ui,
    cue: say(ui.cue),
    verdict: v ? { ...v, show: v.show ? say(v.show) : v.show, say: v.say ? say(v.say) : v.say } : v,
    advice: ui.advice ? { ...ui.advice, message: say(ui.advice.message) } : ui.advice,
  };
}
