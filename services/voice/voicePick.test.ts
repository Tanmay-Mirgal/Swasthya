import test from "node:test";
import assert from "node:assert/strict";
import { availability, chooseVoice, primaryLanguage, voicesFor, type VoiceInfo } from "./voicePick";

const v = (voiceURI: string, lang: string, localService = true): VoiceInfo => ({ voiceURI, name: voiceURI, lang, localService });

const MAC = [v("daniel", "en-GB"), v("samantha", "en-US"), v("lekha", "hi-IN"), v("rishi", "en-IN"), v("zuzana", "cs-CZ")];
const ANDROID = [v("en_IN", "en_IN"), v("hi_IN", "hi_IN"), v("mr_IN", "mr_IN"), v("net-hi", "hi-IN", false)];

test("voices are matched by the language they were built for, including Android's underscore and three-letter codes", () => {
  assert.equal(primaryLanguage("hi-IN"), "hi");
  assert.equal(primaryLanguage("hi_IN"), "hi");
  assert.equal(primaryLanguage("hin"), "hi");
  assert.equal(primaryLanguage("MR-in"), "mr");
  assert.deepEqual(voicesFor(MAC, "hi").map((x) => x.voiceURI), ["lekha"]);
  assert.deepEqual(voicesFor(ANDROID, "mr").map((x) => x.voiceURI), ["mr_IN"]);
});

test("Hindi text gets a Hindi voice, never an English one", () => {
  const c = chooseVoice(MAC, "hi");
  assert.equal(c.voice?.voiceURI, "lekha");
  assert.equal(c.lang, "hi");
  assert.equal(c.borrowed, false);
});

test("on a device with a Marathi voice, Marathi uses it; the device's own voice beats a network one", () => {
  assert.equal(chooseVoice(ANDROID, "mr").voice?.voiceURI, "mr_IN");
  assert.equal(chooseVoice(ANDROID, "hi").voice?.voiceURI, "hi_IN", "local voice preferred over the network voice");
});

test("Marathi falls back to a Hindi voice (same script) and says so", () => {
  const c = chooseVoice(MAC, "mr");
  assert.equal(c.voice?.voiceURI, "lekha");
  assert.equal(c.borrowed, true);
  assert.equal(c.lang, "mr");
});

test("with no suitable voice there is NO voice, so the caller can say it in English instead of misreading Devanagari", () => {
  const english = [v("daniel", "en-GB")];
  assert.equal(chooseVoice(english, "hi").voice, null);
  assert.equal(chooseVoice(english, "mr").voice, null);
  assert.equal(chooseVoice(MAC, "hi", "samantha").voice?.voiceURI, "lekha", "an English voice picked earlier is not used for Hindi");
});

test("the person's own pick is honoured only for the language it speaks", () => {
  assert.equal(chooseVoice(ANDROID, "hi", "net-hi").voice?.voiceURI, "net-hi");
  assert.equal(chooseVoice(ANDROID, "mr", "net-hi").voice?.voiceURI, "mr_IN", "a Hindi pick does not apply to Marathi when Marathi exists");
  assert.equal(chooseVoice(MAC, "en", "daniel").voice?.voiceURI, "daniel");
  assert.equal(chooseVoice(MAC, "en", "lekha").voice, null, "a Hindi voice is not used for English");
});

test("English with no choice keeps the device's default voice, as it always did", () => {
  const c = chooseVoice(MAC, "en");
  assert.equal(c.voice, null);
  assert.equal(c.lang, "en");
});

test("availability tells the settings screen what to say", () => {
  assert.equal(availability(MAC, "en"), "own");
  assert.equal(availability(MAC, "hi"), "own");
  assert.equal(availability(MAC, "mr"), "borrowed");
  assert.equal(availability([v("daniel", "en-GB")], "hi"), "none");
  assert.equal(availability([], "hi"), "unknown", "the voice list loads late in some browsers");
});
