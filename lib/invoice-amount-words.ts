const BELOW_TWENTY = [
  "ZERO",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
] as const;

const TENS = [
  "",
  "",
  "TWENTY",
  "THIRTY",
  "FORTY",
  "FIFTY",
  "SIXTY",
  "SEVENTY",
  "EIGHTY",
  "NINETY",
] as const;

const THOUSANDS = ["", "THOUSAND", "MILLION", "BILLION"] as const;

function chunkToWords(chunk: number): string {
  if (chunk === 0) return "";
  if (chunk < 20) return BELOW_TWENTY[chunk] ?? "";
  if (chunk < 100) {
    const tens = Math.floor(chunk / 10);
    const ones = chunk % 10;
    return ones === 0
      ? TENS[tens] ?? ""
      : `${TENS[tens]} ${BELOW_TWENTY[ones]}`.trim();
  }

  const hundreds = Math.floor(chunk / 100);
  const remainder = chunk % 100;
  const hundredPart = `${BELOW_TWENTY[hundreds]} HUNDRED`;
  if (remainder === 0) return hundredPart;
  return `${hundredPart} AND ${chunkToWords(remainder)}`;
}

/** Convert a non-negative integer to English words (uppercase, no currency). */
export function integerToEnglishWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Amount must be a non-negative finite number");
  }

  const rounded = Math.round(value);
  if (rounded === 0) return BELOW_TWENTY[0];

  const parts: string[] = [];
  let remaining = rounded;
  let scale = 0;

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = chunkToWords(chunk);
      const scaleWord = THOUSANDS[scale] ?? "";
      parts.unshift(
        scaleWord ? `${chunkWords} ${scaleWord}`.trim() : chunkWords
      );
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function splitMoneyParts(amount: number): { major: number; minor: number } {
  const rounded = Math.round(amount * 100) / 100;
  const major = Math.floor(rounded);
  const minor = Math.round((rounded - major) * 100);
  return { major, minor };
}

export function formatThaiBahtAmountInWords(amount: number): string {
  const { major, minor } = splitMoneyParts(amount);
  let words = `THAI BAHT ${integerToEnglishWords(major)}`;
  if (minor > 0) {
    words += ` AND CENTS ${integerToEnglishWords(minor)}`;
  }
  return `${words} ONLY`;
}

export function formatInvoiceAmountInWords(
  amount: number,
  currency: string
): string {
  const normalized = currency.trim().toUpperCase();
  if (normalized === "THB") {
    return formatThaiBahtAmountInWords(amount);
  }
  if (normalized === "MYR") {
    const { major, minor } = splitMoneyParts(amount);
    let words = `RINGGIT MALAYSIA ${integerToEnglishWords(major)}`;
    if (minor > 0) {
      words += ` AND ${integerToEnglishWords(minor)} SEN`;
    }
    return `${words} ONLY`;
  }
  return `${integerToEnglishWords(splitMoneyParts(amount).major)} ONLY`;
}
