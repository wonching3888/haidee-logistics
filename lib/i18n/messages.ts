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
  "common.date": {
    zh: "日期",
    en: "Date",
    th: "วันที่",
  },
  "common.consignor": {
    zh: "寄货人",
    en: "Consignor",
    th: "ผู้ส่ง",
  },
  "common.all": {
    zh: "全部",
    en: "All",
    th: "ทั้งหมด",
  },
  "common.status": {
    zh: "状态",
    en: "Status",
    th: "สถานะ",
  },
  "common.search": {
    zh: "搜索",
    en: "Search",
    th: "ค้นหา",
  },
  "common.area": {
    zh: "地区",
    en: "Area",
    th: "เขตพื้นที่",
  },
  "common.total": {
    zh: "总数量",
    en: "Total",
    th: "จำนวนรวม",
  },
  "common.actions": {
    zh: "操作",
    en: "Actions",
    th: "จัดการ",
  },
  "common.edit": {
    zh: "编辑",
    en: "Edit",
    th: "แก้ไข",
  },
  "common.draft": {
    zh: "草稿",
    en: "Draft",
    th: "ฉบับร่าง",
  },
  "common.crateUnit": {
    zh: "桶",
    en: "crates",
    th: "ลัง",
  },
  "common.boxUnit": {
    zh: "盒",
    en: "boxes",
    th: "กล่อง",
  },
  "inbound.pageTitle": {
    zh: "进货录入",
    en: "Inbound Entry",
    th: "นำเข้าสินค้า",
  },
  "inbound.pageSubtitle": {
    zh: "每日进货批次录入与管理",
    en: "Daily inbound batch management",
    th: "บันทึกและจัดการล็อตสินค้าเข้าประจำวัน",
  },
  "inbound.new": {
    zh: "新增进货",
    en: "New Inbound",
    th: "เพิ่มสินค้าเข้า",
  },
  "inbound.newSubtitle": {
    zh: "选择寄货人后自动带出固定收货人列表",
    en: "Select consignor to load default receivers",
    th: "เลือกผู้ส่งเพื่อแสดงรายชื่อผู้รับประจำ",
  },
  "inbound.edit": {
    zh: "编辑进货",
    en: "Edit Inbound",
    th: "แก้ไขสินค้าเข้า",
  },
  "inbound.emptyList": {
    zh: "暂无进货记录",
    en: "No inbound records found",
    th: "ไม่พบรายการสินค้าเข้า",
  },
  "inbound.batchNo": {
    zh: "批次号",
    en: "Batch",
    th: "เลขที่ล็อต",
  },
  "inbound.pickup": {
    zh: "收货地点",
    en: "Pickup",
    th: "จุดรับสินค้า",
  },
  "inbound.thPlate": {
    zh: "车牌",
    en: "TH Plt",
    th: "ทะเบียนรถ",
  },
  "inbound.unassigned": {
    zh: "未分配",
    en: "Unassigned",
    th: "ยังไม่จัดรถ",
  },
  "inbound.statusAssigned": {
    zh: "已分配",
    en: "Assigned",
    th: "จัดรถแล้ว",
  },
  "inbound.searchPlaceholder": {
    zh: "寄货人名称…",
    en: "Consignor name…",
    th: "ชื่อผู้ส่ง…",
  },
  "inbound.searchButton": {
    zh: "搜",
    en: "Go",
    th: "ค้น",
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
