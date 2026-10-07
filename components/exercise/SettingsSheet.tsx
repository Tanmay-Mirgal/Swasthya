"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button, Dialog, Notice, Switch } from "@/components/ui";
import VoiceService from "@/services/voice/voiceService";
import { START_FOR_ME_OPTIONS, VIEW_SCALES, VOICE_RATE_RANGE, type StartForMe, type VoiceSettings } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { languageInfo, type LanguageCode } from "@/lib/i18n/languages";
import type { VoiceAvailability } from "@/services/voice/voicePick";

interface Props {
  open: boolean;
  onClose: () => void;
  voiceEnabled: boolean;
  onVoiceEnabled: (on: boolean) => void;
  settings: VoiceSettings;
  onChange: (patch: Partial<VoiceSettings>) => void;
  /** The language the coach speaks, from the language switcher. */
  language: LanguageCode;
  /** The size of text on the exercise screen, chosen for where the patient sits. Shown only when the screen supports it. */
  viewScale?: number;
  onViewScale?: (scale: number) => void;
  /** Hands-free rest: start the next set by itself after this long. Shown only when the screen supports it. */
  startForMe?: StartForMe;
  onStartForMe?: (seconds: StartForMe) => void;
}

const SIZE_NAMES: Record<number, string> = { 1: "Standard", 1.25: "Large", 1.5: "Larger", 2: "Largest" };

const SAMPLE = "Raise your arm a little higher. That’s better.";

/** Voice and sound, in plain words. Every spoken line can also be kept on screen as text, so nothing depends on hearing. */
export default function SettingsSheet({ open, onClose, voiceEnabled, onVoiceEnabled, settings, onChange, language, viewScale, onViewScale, startForMe, onStartForMe }: Props) {
  const [voices, setVoices] = useState<{ voiceURI: string; name: string; lang: string }[]>([]);
  const [availability, setAvailability] = useState<VoiceAvailability>("unknown");
  useEffect(() => {
    if (!open || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      setVoices(VoiceService.getVoices(language));
      setAvailability(VoiceService.availability(language));
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [open, language]);

  const native = languageInfo(language).native;
  const chosen = language === "en" ? settings.voiceURI : (settings.voiceByLang[language] ?? null);
  const supported = VoiceService.isSupported();
  return (
    <Dialog open={open} onClose={onClose} title="Voice and sound" description="Changes apply straight away and are remembered on this device." footer={<Button size="lg" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-6 text-base">
        <Switch id="voice-on" label="Voice coach" description={supported ? "Speaks short instructions and encouragement." : "This device can’t speak aloud. Everything is shown on screen."} checked={voiceEnabled && supported} onChange={onVoiceEnabled} />

        <div>
          <label htmlFor="voice-volume" className="flex items-baseline justify-between text-base font-semibold text-slate-900">
            Volume <span className="font-mono text-slate-700 tabular">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input id="voice-volume" type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="mt-2 h-11 w-full accent-emerald-700" />
        </div>

        <div>
          <label htmlFor="voice-rate" className="flex items-baseline justify-between text-base font-semibold text-slate-900">
            Speaking speed <span className="text-slate-700">{settings.rate <= 0.85 ? "Slower" : settings.rate >= 1.05 ? "Faster" : "Normal"}</span>
          </label>
          <input id="voice-rate" type="range" min={VOICE_RATE_RANGE.min} max={VOICE_RATE_RANGE.max} step={0.05} value={settings.rate} onChange={(e) => onChange({ rate: Number(e.target.value) })} className="mt-2 h-11 w-full accent-emerald-700" />
        </div>

        {language !== "en" && supported && (
          <p className="text-base text-slate-800">
            The coach speaks <span className="font-semibold" translate="no">{native}</span>. Change it with the language button at the top of the page.
          </p>
        )}
        {language !== "en" && supported && availability === "none" && (
          <Notice tone="warning" title={`No ${languageInfo(language).label} voice on this device`}>
            The coach will speak in English instead, and what is said is shown as text. You can add a {languageInfo(language).label} voice in your device’s speech settings.
          </Notice>
        )}
        {language === "mr" && supported && availability === "borrowed" && (
          <Notice tone="info" title="Using a Hindi voice for Marathi">
            This device has no Marathi voice. A Hindi voice reads Marathi in the same script, so it is understandable, but some words may sound different.
          </Notice>
        )}

        {voices.length > 1 && (
          <div>
            <label htmlFor="voice-voice" className="block text-base font-semibold text-slate-900">Voice</label>
            <select
              id="voice-voice"
              value={chosen ?? ""}
              onChange={(e) => (language === "en" ? onChange({ voiceURI: e.target.value || null }) : onChange({ voiceByLang: { ...settings.voiceByLang, [language]: e.target.value || undefined } }))}
              className="mt-2 h-12 w-full rounded-lg border border-slate-400 bg-white px-3 text-base"
            >
              <option value="">This device’s default</option>
              {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
          </div>
        )}

        <Button
          size="lg"
          variant="outline"
          disabled={!supported}
          onClick={() => {
            VoiceService.prime();
            VoiceService.speak(SAMPLE, { interrupt: true });
          }}
        >
          <Volume2 className="size-5" aria-hidden="true" /> Hear a sample
        </Button>

        {onViewScale && viewScale !== undefined && (
          <div role="group" aria-labelledby="view-scale-label">
            <p id="view-scale-label" className="text-base font-semibold text-slate-900">Size of text on the exercise screen</p>
            <p className="text-sm text-slate-700">Pick the smallest size you can read from where you sit.</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VIEW_SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onViewScale(s)}
                  aria-pressed={viewScale === s}
                  className={cn("min-h-12 rounded-lg border-2 px-2 text-base font-semibold", viewScale === s ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-400 bg-white text-slate-900 hover:bg-slate-50")}
                >
                  {SIZE_NAMES[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {onStartForMe && startForMe !== undefined && (
          <div role="group" aria-labelledby="start-for-me-label">
            <p id="start-for-me-label" className="text-base font-semibold text-slate-900">After a rest, start the next set for me</p>
            <p className="text-sm text-slate-700">It always counts down 3, 2, 1 first. You can also press Space or Enter, or tap Start.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {START_FOR_ME_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStartForMe(s)}
                  aria-pressed={startForMe === s}
                  className={cn("min-h-12 rounded-lg border-2 px-2 text-base font-semibold", startForMe === s ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-400 bg-white text-slate-900 hover:bg-slate-50")}
                >
                  {s === 0 ? "Never" : s === 30 ? "After 30 seconds" : "After 1 minute"}
                </button>
              ))}
            </div>
          </div>
        )}

        <Switch id="voice-captions" label="Show what is said" description="Keeps the last few spoken lines on screen as text." checked={settings.captions} onChange={(on) => onChange({ captions: on })} />

        <Switch id="celebrations" label="Celebrate finished sets" description="A short burst of confetti and a soft sound when you finish a set. The confetti is skipped if your device asks for less motion." checked={settings.celebrations} onChange={(on) => onChange({ celebrations: on })} />
      </div>
    </Dialog>
  );
}
