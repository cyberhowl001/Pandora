import { Check } from "lucide-react";
import { Sheet } from "./ui";
import { useTheme, THEMES } from "./theme";
import {
  PANDORA_RULES_TITLE, PANDORA_RULES_TEXT, PANDORA_APP_VERSION, PANDORA_VERSION_NOTES,
} from "./pandoraInfo";

// "?" button: rules, regulations and app version (edit the text in pandoraInfo.js)
export function RulesSheet({ onClose }) {
  const { t } = useTheme();
  return (
    <Sheet title={PANDORA_RULES_TITLE} onClose={onClose}>
      <p className="text-sm whitespace-pre-line leading-relaxed">{PANDORA_RULES_TEXT}</p>
      <div className={`mt-6 pt-4 border-t ${t.line}`}>
        <p className="font-black text-sm">App version {PANDORA_APP_VERSION}</p>
        <p className={`text-sm whitespace-pre-line mt-2 ${t.sub}`}>{PANDORA_VERSION_NOTES}</p>
      </div>
    </Sheet>
  );
}

export function ThemeSheet({ onClose }) {
  const { t, base, darkOn, chooseTheme } = useTheme();
  return (
    <Sheet title="Theme" onClose={onClose} full={false}>
      <div className="flex justify-center gap-10 py-6">
        {["light", "purple"].map((k) => {
          const selected = !darkOn && base === k;
          return (
            <button key={k} onClick={() => chooseTheme(k)} className="relative">
              <span
                className={`block w-24 h-24 rounded-full border-4 ${selected ? "border-violet-500" : "border-transparent"} shadow-lg`}
                style={{ background: THEMES[k].swatch }}
              />
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check size={30} className={`${t.dark ? "text-white" : "text-black"} drop-shadow`} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
