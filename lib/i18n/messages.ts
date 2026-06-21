import type { UserLanguage } from "@/types";

export const MESSAGES = {
  "nav.dashboard": {
    zh: "总览",
    en: "Dashboard",
    th: "ภาพรวม",
  },
  "nav.operations": {
    zh: "物流操作",
    en: "Operations",
    th: "ปฏิบัติการ",
  },
  "nav.inbound": {
    zh: "进货录入",
    en: "Inbound",
    th: "นำเข้าสินค้า",
  },
  "nav.dispatch": {
    zh: "派车调度",
    en: "Dispatch",
    th: "จัดรถ",
  },
  "nav.charter": {
    zh: "包车",
    en: "Charter",
    th: "เหมารถ",
  },
  "nav.summary": {
    zh: "每日总单",
    en: "Daily Summary",
    th: "สรุปประจำวัน",
  },
  "nav.search": {
    zh: "查询",
    en: "Search",
    th: "ค้นหา",
  },
  "nav.documents": {
    zh: "文件",
    en: "Documents",
    th: "เอกสาร",
  },
  "nav.documentsGenerate": {
    zh: "文件生成",
    en: "Documents",
    th: "ออกเอกสาร",
  },
  "nav.monthlyInvoice": {
    zh: "账单",
    en: "INVOICE",
    th: "ใบแจ้งหนี้",
  },
  "nav.partnerTripInvoice": {
    zh: "合作伙伴车力单",
    en: "Partner Trip Invoice",
    th: "ใบแจ้งหนี้พาร์ทเนอร์",
  },
  "nav.crateReturnInvoice": {
    zh: "回收桶月结单",
    en: "Crate Return Invoice",
    th: "ใบแจ้งหนี้คืนถัง",
  },
  "nav.driverExpenses": {
    zh: "司机费用单",
    en: "Driver Expenses",
    th: "ค่าใช้จ่ายคนขับ",
  },
  "nav.crate": {
    zh: "桶管理",
    en: "Crate Management",
    th: "จัดการถัง",
  },
  "nav.crateImport": {
    zh: "空桶回收",
    en: "Crate Import",
    th: "รับถังเปล่า",
  },
  "nav.crateExport": {
    zh: "空桶归还",
    en: "Crate Export",
    th: "คืนถังเปล่า",
  },
  "nav.crateStock": {
    zh: "桶库存",
    en: "Crate Stock",
    th: "สต๊อกถัง",
  },
  "nav.customerCrateStock": {
    zh: "顾客桶库存",
    en: "Customer Crate Stock",
    th: "สต๊อกถังลูกค้า",
  },
  "nav.reports": {
    zh: "报表",
    en: "Reports",
    th: "รายงาน",
  },
  "nav.marketReport": {
    zh: "市场报表",
    en: "Market Report",
    th: "รายงานตลาด",
  },
  "nav.crateReport": {
    zh: "桶型报表",
    en: "Crate Report",
    th: "รายงานประเภทถัง",
  },
  "nav.crateRental": {
    zh: "租桶月结",
    en: "Crate Rental Statement",
    th: "ใบสรุปค่าเช่าถัง",
  },
  "nav.operationsReport": {
    zh: "运营报表",
    en: "Operations",
    th: "รายงานปฏิบัติการ",
  },
  "nav.pnl": {
    zh: "损益分析",
    en: "P&L Analysis",
    th: "วิเคราะห์กำไรขาดทุน",
  },
  "nav.driverPayroll": {
    zh: "司机薪资",
    en: "Driver Payroll",
    th: "เงินเดือนคนขับ",
  },
  "nav.history": {
    zh: "修改记录",
    en: "History",
    th: "ประวัติแก้ไข",
  },
  "nav.settings": {
    zh: "系统设置",
    en: "Settings",
    th: "ตั้งค่าระบบ",
  },
} as const satisfies Record<
  string,
  { zh: string; en: string; th: string }
>;

export type MessageKey = keyof typeof MESSAGES;

export function normalizeUserLanguage(
  value: string | null | undefined
): UserLanguage {
  return value === "th" ? "th" : "zh";
}
