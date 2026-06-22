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
  "common.cancel": {
    zh: "取消",
    en: "Cancel",
    th: "ยกเลิก",
  },
  "common.delete": {
    zh: "删除",
    en: "Delete",
    th: "ลบ",
  },
  "common.receiver": {
    zh: "收货人",
    en: "Receiver",
    th: "ผู้รับ",
  },
  "common.crateType": {
    zh: "桶型",
    en: "Crate Type",
    th: "ประเภทลัง",
  },
  "common.crateCount": {
    zh: "桶数",
    en: "Crates",
    th: "จำนวนลัง",
  },
  "common.qty": {
    zh: "数量",
    en: "Qty",
    th: "จำนวน",
  },
  "common.destination": {
    zh: "目的地",
    en: "Destination",
    th: "ปลายทาง",
  },
  "common.optional": {
    zh: "选填",
    en: "(optional)",
    th: "(ไม่บังคับ)",
  },
  "common.saving": {
    zh: "保存中…",
    en: "Saving…",
    th: "กำลังบันทึก…",
  },
  "common.deleting": {
    zh: "删除中…",
    en: "Deleting…",
    th: "กำลังลบ…",
  },
  "inbound.selectConsignor": {
    zh: "— 选择寄货人",
    en: "Select —",
    th: "— เลือกผู้ส่ง —",
  },
  "inbound.tripPickup": {
    zh: "本趟收货地点",
    en: "Trip Pickup",
    th: "จุดรับสินค้าเที่ยวนี้",
  },
  "inbound.areaNote": {
    zh: "地区/备注",
    en: "Area/Note",
    th: "เขต/หมายเหตุ",
  },
  "inbound.thPlateField": {
    zh: "泰国车牌",
    en: "TH Plate",
    th: "ทะเบียนรถไทย",
  },
  "inbound.loadingReceivers": {
    zh: "加载收货人…",
    en: "Loading receivers…",
    th: "กำลังโหลดผู้รับ…",
  },
  "inbound.noDefaultReceivers": {
    zh: "此寄货人暂无固定收货人，请先在系统设置中添加。",
    en: "No default receivers for this consignor.",
    th: "ผู้ส่งรายนี้ยังไม่มีผู้รับประจำ กรุณาเพิ่มในการตั้งค่าระบบก่อน",
  },
  "inbound.addReceiver": {
    zh: "新增收货人",
    en: "Add Receiver",
    th: "เพิ่มผู้รับ",
  },
  "inbound.marketField": {
    zh: "地区",
    en: "Market",
    th: "ตลาด",
  },
  "inbound.receiverCode": {
    zh: "收货人代码",
    en: "Code",
    th: "รหัสผู้รับ",
  },
  "inbound.confirmAdd": {
    zh: "确认添加",
    en: "Add",
    th: "ยืนยันเพิ่ม",
  },
  "inbound.marketSubtotals": {
    zh: "各市场小计",
    en: "Market Subtotals",
    th: "ยอดรวมแต่ละตลาด",
  },
  "inbound.saveDraft": {
    zh: "保存草稿",
    en: "Save Draft",
    th: "บันทึกฉบับร่าง",
  },
  "inbound.confirmSave": {
    zh: "确认保存",
    en: "Confirm",
    th: "ยืนยันบันทึก",
  },
  "inbound.addLineSameReceiver": {
    zh: "同收货人加一行",
    en: "Add line (same receiver)",
    th: "เพิ่มแถว (ผู้รับเดิม)",
  },
  "inbound.deleteReceiverConfirm": {
    zh: "确定要永久删除收货人 {code} 吗？",
    en: "Are you sure to permanently delete receiver {code}?",
    th: "ต้องการลบผู้รับ {code} อย่างถาวรหรือไม่?",
  },
  "inbound.deleteSessionConfirm": {
    zh: "确定要删除这张进货单吗？此操作无法撤销。",
    en: "Are you sure you want to delete this inbound session? This cannot be undone.",
    th: "ต้องการลบรายการนำเข้านี้หรือไม่? การกระทำนี้ย้อนกลับไม่ได้",
  },
  "inbound.deleteSession": {
    zh: "删除进货单",
    en: "Delete inbound session",
    th: "ลบรายการนำเข้า",
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
