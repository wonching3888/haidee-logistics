import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";
import type { UserLanguage } from "@/types";

export function getMessageParts(key: MessageKey, locale: UserLanguage) {
  const message = MESSAGES[key];
  return { local: message[locale], en: message.en };
}

/** Local language + English, e.g. zh → "进货录入 Inbound", th → "นำเข้าสินค้า Inbound". */
export function t(key: MessageKey, locale: UserLanguage): string {
  const { local, en } = getMessageParts(key, locale);
  return `${local} ${en}`;
}
