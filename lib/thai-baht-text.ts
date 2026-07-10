/**
 * Thai baht amount in words (จำนวนเงินตัวอักษร).
 *
 * Algorithm follows Microsoft Excel BAHTTEXT() conventions, as implemented in
 * widely used references such as earthchie/BAHTTEXT.js and anuchito/bahttext.
 * Key grammar rules applied after digit assembly:
 *   - หนึ่งสิบ → สิบ
 *   - สองสิบ → ยี่สิบ
 *   - สิบหนึ่ง → สิบเอ็ด
 * Trailing 1 in the ones place (non-satang suffix) → เอ็ด.
 * Integer amounts with zero satang → ...บาทถ้วน; otherwise ...สตางค์.
 */

const DIGIT_NAMES = [
  "",
  "หนึ่ง",
  "สอง",
  "สาม",
  "สี่",
  "ห้า",
  "หก",
  "เจ็ด",
  "แปด",
  "เก้า",
] as const;

const PLACE_NAMES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"] as const;

type BahtTextSuffix = "บาทถ้วน" | "สตางค์";

function applyThaiNumberGrammar(text: string): string {
  return text
    .replace(/หนึ่งสิบ/g, "สิบ")
    .replace(/สองสิบ/g, "ยี่สิบ")
    .replace(/สิบหนึ่ง/g, "สิบเอ็ด");
}

/** Convert a non-negative integer string (no decimals) to Thai words. */
function integerStringToThaiWords(
  numStr: string,
  suffix: BahtTextSuffix
): string {
  const normalized = numStr.replace(/^0+/, "") || "0";
  if (normalized === "0") {
    return suffix === "บาทถ้วน" ? "ศูนย์" : "";
  }

  if (normalized.length > 7) {
    const overflow = normalized.substring(0, normalized.length - 6);
    const remains = normalized.slice(-6);
    const overflowText = integerStringToThaiWords(overflow, "บาทถ้วน").replace(
      "บาทถ้วน",
      "ล้าน"
    );
    const remainsText = integerStringToThaiWords(remains, suffix).replace(
      /^ศูนย์/,
      ""
    );
    return overflowText + remainsText;
  }

  let text = "";
  const len = normalized.length;
  for (let i = 0; i < len; i += 1) {
    const digit = Number(normalized.charAt(i));
    if (digit <= 0) continue;

    const placeIndex = len - 1 - i;
    const place = PLACE_NAMES[placeIndex] ?? "";

    if (
      len > 1 &&
      i === len - 1 &&
      digit === 1 &&
      suffix !== "สตางค์"
    ) {
      text += `เอ็ด${place}`;
    } else {
      text += `${DIGIT_NAMES[digit]}${place}`;
    }
  }

  return applyThaiNumberGrammar(text);
}

/**
 * Format a THB amount as Thai baht text for Payment Voucher print.
 * Examples (BAHTTEXT-compatible):
 *   1500     → หนึ่งพันห้าร้อยบาทถ้วน
 *   1255.32  → หนึ่งพันสองร้อยห้าสิบห้าบาทสามสิบสองสตางค์
 *   21       → ยี่สิบเอ็ดบาทถ้วน
 */
export function formatThbPaymentVoucherAmountInWords(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }

  const rounded = Math.round(amount * 100) / 100;
  if (rounded === 0) {
    return "ศูนย์บาทถ้วน";
  }

  const [bahtPart, satangPart] = rounded.toFixed(2).split(".");
  const bahtInt = Number(bahtPart);
  const satangInt = Number(satangPart);

  let text = "";
  if (bahtInt > 0) {
    text = `${integerStringToThaiWords(bahtPart!, "บาทถ้วน")}บาท`;
  }

  if (satangInt > 0) {
    text += `${integerStringToThaiWords(satangPart!, "สตางค์")}สตางค์`;
  } else {
    text += "ถ้วน";
  }

  return text || "ศูนย์บาทถ้วน";
}
