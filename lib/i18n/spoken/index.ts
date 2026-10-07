/**
 * lib/i18n/spoken/index.ts
 *
 * Turns a line the coach is about to say (always written in English) into the language the person chose, so the
 * voice, the captions and the screen all say the same thing. Pure and offline: every sentence comes from a reviewed
 * catalogue (`entries.ts`). Nothing is machine-translated at run time, because a wrong word in a safety cue is worse
 * than no translation.
 *
 * A line is translated sentence by sentence ("Not counted. Sit tall." is two sentences). If ANY sentence has no
 * entry the whole line is left alone (`null`), so the caller can say it in English with an English voice rather than
 * mixing languages in one breath.
 */
import type { LanguageCode } from "../languages";
import { SYSTEM_ENTRIES, TEMPLATE_ENTRIES, type Entry } from "./entries";

type Target = Exclude<LanguageCode, "en">;

const INDEX: Record<Target, Map<string, string>> = { hi: new Map(), mr: new Map() };
for (const [en, hi, mr] of [...SYSTEM_ENTRIES, ...TEMPLATE_ENTRIES]) {
  INDEX.hi.set(key(en), hi);
  INDEX.mr.set(key(en), mr);
}

function key(sentence: string): string {
  return sentence.trim().replace(/[’‘]/g, "'").replace(/[.!?]+$/, "").trim();
}

/** English sentences with their ends removed, as the catalogue stores them. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/[’‘]/g, "'")
    .split(/(?<=[.!?])\s+/)
    .map(key)
    .filter(Boolean);
}

// ── Body words, for camera advice that names a joint ──────────────────────────────────────────────────────────────

type Gender = "m" | "f" | "n";
interface Part { hi: [string, "m" | "f"]; mr: [string, Gender] }

/** The joints cameraCheck can name (`describeRef`): noun and grammatical gender, so "your" and "left" agree. */
const PARTS: Record<string, Part> = {
  head: { hi: ["सिर", "m"], mr: ["डोके", "n"] },
  ear: { hi: ["कान", "m"], mr: ["कान", "m"] },
  shoulder: { hi: ["कंधा", "m"], mr: ["खांदा", "m"] },
  elbow: { hi: ["कोहनी", "f"], mr: ["कोपर", "n"] },
  wrist: { hi: ["कलाई", "f"], mr: ["मनगट", "n"] },
  hip: { hi: ["कूल्हा", "m"], mr: ["कंबर", "f"] },
  knee: { hi: ["घुटना", "m"], mr: ["गुडघा", "m"] },
  ankle: { hi: ["टखना", "m"], mr: ["घोटा", "m"] },
  heel: { hi: ["एड़ी", "f"], mr: ["टाच", "f"] },
  foot: { hi: ["पैर", "m"], mr: ["पाऊल", "n"] },
  body: { hi: ["शरीर", "m"], mr: ["शरीर", "n"] },
};

const SIDE: Record<Target, Record<"left" | "right", Record<Gender, string>>> = {
  hi: { left: { m: "बायाँ", f: "बाईं", n: "बायाँ" }, right: { m: "दायाँ", f: "दाईं", n: "दायाँ" } },
  mr: { left: { m: "डावा", f: "डावी", n: "डावे" }, right: { m: "उजवा", f: "उजवी", n: "उजवे" } },
};
const POSS: Record<Target, Record<Gender, string>> = {
  hi: { m: "आपका", f: "आपकी", n: "आपका" },
  mr: { m: "तुमचा", f: "तुमची", n: "तुमचे" },
};

/** "your left knee" in the target language, or null when the name is not one we know. */
function yourPart(name: string, lang: Target): { phrase: string; gender: Gender } | null {
  const m = /^(?:(left|right) )?([a-z]+)$/.exec(name.trim().toLowerCase());
  const part = m ? PARTS[m[2]] : undefined;
  if (!m || !part) return null;
  const [noun, gender] = lang === "hi" ? part.hi : part.mr;
  const side = m[1] ? `${SIDE[lang][m[1] as "left" | "right"][gender]} ` : "";
  return { phrase: `${POSS[lang][gender]} ${side}${noun}`, gender };
}

/** The word cameraCheck uses for the stretch of body that must stay in view. */
const SEGMENTS: Record<string, [hi: string, mr: string]> = {
  leg: ["पैर", "पाय"],
  legs: ["पैर", "पाय"],
  arm: ["हाथ", "हात"],
  body: ["शरीर", "शरीर"],
  "head and shoulders": ["सिर और कंधे", "डोके आणि खांदे"],
  "legs and feet": ["पैर और पंजे", "पाय आणि पंजे"],
};

type Pattern = { re: RegExp; make: (m: RegExpExecArray, lang: Target) => string | null };

/** Sentences with a slot in them: a joint, a body segment or a number. */
const PATTERNS: Pattern[] = [
  {
    re: /^Your ((?:left |right )?[a-z]+) is at the edge of the frame$/,
    make: (m, lang) => {
      const p = yourPart(m[1], lang);
      return p ? (lang === "hi" ? `${p.phrase} फ्रेम के किनारे पर है` : `${p.phrase} फ्रेमच्या कडेला आहे`) : null;
    },
  },
  {
    re: /^I can't clearly see your ((?:left |right )?[a-z]+)$/,
    make: (m, lang) => {
      const p = yourPart(m[1], lang);
      if (!p) return null;
      return lang === "hi" ? `${p.phrase} साफ़ दिखाई नहीं दे ${p.gender === "f" ? "रही" : "रहा"}` : `${p.phrase} नीट दिसत नाही`;
    },
  },
  {
    re: /^Improve the lighting and keep your whole ([a-z ]+) in view$/,
    make: (m, lang) => {
      const seg = SEGMENTS[m[1]];
      if (!seg) return null;
      return lang === "hi" ? `रोशनी बेहतर कीजिए और ${seg[0]} को पूरा कैमरे के सामने रखिए` : `प्रकाश चांगला करा आणि ${seg[1]} पूर्ण कॅमेऱ्यासमोर ठेवा`;
    },
  },
  { re: /^(\d+) done$/, make: (m, lang) => (lang === "hi" ? `${m[1]} पूरे` : `${m[1]} पूर्ण`) },
  {
    re: /^You fixed (\d+) things? as you went$/,
    make: (m, lang) => {
      const n = Number(m[1]);
      if (lang === "hi") return n === 1 ? "चलते-चलते आपने एक बात सुधारी" : `चलते-चलते आपने ${n} बातें सुधारीं`;
      return n === 1 ? "करताना तुम्ही एक गोष्ट सुधारली" : `करताना तुम्ही ${n} गोष्टी सुधारल्या`;
    },
  },
];

function translateSentence(sentence: string, lang: Target): string | null {
  const hit = INDEX[lang].get(sentence);
  if (hit) return hit;
  for (const p of PATTERNS) {
    const m = p.re.exec(sentence);
    if (m) return p.make(m, lang);
  }
  return null;
}

const END: Record<Target, string> = { hi: "।", mr: "." };

/**
 * The line in `lang`, or `null` when any part of it has no reviewed translation. English returns the text unchanged.
 */
export function localizeSpoken(text: string, lang: LanguageCode): string | null {
  if (lang === "en") return text;
  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;
  const out: string[] = [];
  for (const s of sentences) {
    const t = translateSentence(s, lang);
    if (t === null) return null;
    out.push(t + END[lang]);
  }
  return out.join(" ");
}

/** For tests: how many sentences each language can say. */
export const CATALOGUE_SIZE = { hi: INDEX.hi.size, mr: INDEX.mr.size } as const;
export type { Entry };
