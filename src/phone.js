// Accepts a phone number from any country and returns it in international (E.164) form.
//   "+234 801 234 5678"  -> "+2348012345678"
//   "0044 20 7946 0958"  -> "+442079460958"
//   "+1 (555) 010-9999"  -> "+15550109999"
// Numbers must include the country code (a leading + or 00).
export function normalizePhone(input) {
  let s = (input || "").trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) return { error: "Start with your country code, for example +234, +1 or +44." };
  const digits = s.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return { error: "Please enter a valid phone number with its country code." };
  return { value: "+" + digits };
}
