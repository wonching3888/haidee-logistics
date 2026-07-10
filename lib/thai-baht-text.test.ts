import { describe, expect, it } from "vitest";
import { formatThbPaymentVoucherAmountInWords } from "@/lib/thai-baht-text";

/**
 * Expected strings cross-checked against Excel BAHTTEXT / earthchie BAHTTEXT.js /
 * github.com/anuchito/bahttext reference tables (Thai accounting de-facto standard).
 */
describe("formatThbPaymentVoucherAmountInWords", () => {
  it("handles zero", () => {
    expect(formatThbPaymentVoucherAmountInWords(0)).toBe("ศูนย์บาทถ้วน");
  });

  it("uses ยี่สิบ for twenty (not สองสิบ)", () => {
    expect(formatThbPaymentVoucherAmountInWords(20)).toBe("ยี่สิบบาทถ้วน");
    expect(formatThbPaymentVoucherAmountInWords(20.25)).toBe(
      "ยี่สิบบาทยี่สิบห้าสตางค์"
    );
  });

  it("uses เอ็ด for trailing one in baht part", () => {
    expect(formatThbPaymentVoucherAmountInWords(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(formatThbPaymentVoucherAmountInWords(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(formatThbPaymentVoucherAmountInWords(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(formatThbPaymentVoucherAmountInWords(1001)).toBe(
      "หนึ่งพันเอ็ดบาทถ้วน"
    );
  });

  it("appends บาทถ้วน for integer amounts", () => {
    expect(formatThbPaymentVoucherAmountInWords(1500)).toBe(
      "หนึ่งพันห้าร้อยบาทถ้วน"
    );
    expect(formatThbPaymentVoucherAmountInWords(1)).toBe("หนึ่งบาทถ้วน");
  });

  it("formats satang with สตางค์ suffix", () => {
    expect(formatThbPaymentVoucherAmountInWords(1255.32)).toBe(
      "หนึ่งพันสองร้อยห้าสิบห้าบาทสามสิบสองสตางค์"
    );
    expect(formatThbPaymentVoucherAmountInWords(1.01)).toBe(
      "หนึ่งบาทหนึ่งสตางค์"
    );
    expect(formatThbPaymentVoucherAmountInWords(1234.56)).toBe(
      "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์"
    );
  });

  it("handles large amounts with ล้าน", () => {
    expect(formatThbPaymentVoucherAmountInWords(1_000_000)).toBe(
      "หนึ่งล้านบาทถ้วน"
    );
    expect(formatThbPaymentVoucherAmountInWords(1_270_851.38)).toBe(
      "หนึ่งล้านสองแสนเจ็ดหมื่นแปดร้อยห้าสิบเอ็ดบาทสามสิบแปดสตางค์"
    );
  });
});
