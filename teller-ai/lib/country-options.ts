export const COUNTRY_OPTIONS = [
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "BR", name: "Brazil", dialCode: "+55" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "CN", name: "China", dialCode: "+86" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "GH", name: "Ghana", dialCode: "+233" },
  { code: "IN", name: "India", dialCode: "+91" },
  { code: "ID", name: "Indonesia", dialCode: "+62" },
  { code: "IE", name: "Ireland", dialCode: "+353" },
  { code: "IL", name: "Israel", dialCode: "+972" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "KE", name: "Kenya", dialCode: "+254" },
  { code: "MY", name: "Malaysia", dialCode: "+60" },
  { code: "MX", name: "Mexico", dialCode: "+52" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "NZ", name: "New Zealand", dialCode: "+64" },
  { code: "NG", name: "Nigeria", dialCode: "+234" },
  { code: "PK", name: "Pakistan", dialCode: "+92" },
  { code: "PH", name: "Philippines", dialCode: "+63" },
  { code: "PL", name: "Poland", dialCode: "+48" },
  { code: "PT", name: "Portugal", dialCode: "+351" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "ZA", name: "South Africa", dialCode: "+27" },
  { code: "KR", name: "South Korea", dialCode: "+82" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "SE", name: "Sweden", dialCode: "+46" },
  { code: "CH", name: "Switzerland", dialCode: "+41" },
  { code: "TH", name: "Thailand", dialCode: "+66" },
  { code: "TR", name: "Turkey", dialCode: "+90" },
  { code: "UA", name: "Ukraine", dialCode: "+380" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "US", name: "United States", dialCode: "+1" },
] as const;

export const PHONE_CODE_OPTIONS = COUNTRY_OPTIONS;

export function countryFlag(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397));
}

export function splitInternationalPhone(phone: string) {
  const normalizedPhone = phone.trim().replace(/[\s().-]/g, "");
  const matchingCountry = [...PHONE_CODE_OPTIONS]
    .sort((first, second) => second.dialCode.length - first.dialCode.length)
    .find((country) => normalizedPhone.startsWith(country.dialCode));

  if (!matchingCountry) return { phoneCountryCode: "+1", phoneNumber: phone };
  return {
    phoneCountryCode: matchingCountry.dialCode,
    phoneNumber: normalizedPhone.slice(matchingCountry.dialCode.length),
  };
}