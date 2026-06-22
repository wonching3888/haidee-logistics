import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";
import type { UserLanguage } from "@/types";

export function getMessageParts(key: MessageKey, locale: UserLanguage) {
  const message = MESSAGES[key];
  return { local: message[locale], en: message.en };
}

/** Local-language string only (e.g. confirm dialogs). Supports `{name}` placeholders. */
export function tLocal(
  key: MessageKey,
  locale: UserLanguage,
  vars?: Record<string, string>
): string {
  let text: string = MESSAGES[key][locale];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

/** Local language + English, e.g. zh → "进货录入 Inbound", th → "นำเข้าสินค้า Inbound". */
export function t(
  key: MessageKey,
  locale: UserLanguage,
  vars?: Record<string, string>
): string {
  const parts = getMessageParts(key, locale);
  let local: string = parts.local;
  let en: string = parts.en;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      local = local.replaceAll(`{${name}}`, value);
      en = en.replaceAll(`{${name}}`, value);
    }
  }
  return `${local} ${en}`;
}
