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
    th: "ใบแจ้งหนี้คืนลัง",
  },
  "nav.driverExpenses": {
    zh: "司机费用单",
    en: "Driver Expenses",
    th: "ค่าใช้จ่ายคนขับ",
  },
  "nav.crate": {
    zh: "桶管理",
    en: "Crate Management",
    th: "จัดการลัง",
  },
  "nav.crateImport": {
    zh: "空桶回收",
    en: "Crate Import",
    th: "รับลังเปล่า",
  },
  "nav.crateExport": {
    zh: "空桶归还",
    en: "Crate Export",
    th: "คืนลังเปล่า",
  },
  "nav.crateStock": {
    zh: "桶库存",
    en: "Crate Stock",
    th: "สต๊อกลัง",
  },
  "nav.customerCrateStock": {
    zh: "顾客桶库存",
    en: "Customer Crate Stock",
    th: "สต๊อกลังลูกค้า",
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
    th: "รายงานประเภทลัง",
  },
  "nav.crateRental": {
    zh: "租桶月结",
    en: "Crate Rental Statement",
    th: "ใบสรุปค่าเช่าลัง",
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
  "common.notes": {
    zh: "备注",
    en: "Notes",
    th: "หมายเหตุ",
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
  "inbound.filterToggle": {
    zh: "筛选",
    en: "Filter",
    th: "กรอง",
  },
  "inbound.filtersActive": {
    zh: "已筛选",
    en: "Filtered",
    th: "กรองแล้ว",
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
  "common.save": {
    zh: "保存",
    en: "Save",
    th: "บันทึก",
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
  "pickup.sadao": {
    zh: "SADAO",
    en: "SADAO",
    th: "สะเดา",
  },
  "pickup.songkhla": {
    zh: "宋卡",
    en: "SONGKHLA",
    th: "สงขลา",
  },
  "pickup.pattani": {
    zh: "北大年",
    en: "PATTANI",
    th: "ปัตตานี",
  },
  "error.loadReceiversFailed": {
    zh: "加载收货人失败",
    en: "Failed to load receivers",
    th: "โหลดผู้รับล้มเหลว",
  },
  "error.selectConsignor": {
    zh: "请选择寄货人",
    en: "Please select a consignor",
    th: "กรุณาเลือกผู้ส่ง",
  },
  "error.saveFailed": {
    zh: "保存失败",
    en: "Save failed",
    th: "บันทึกล้มเหลว",
  },
  "error.deleteFailed": {
    zh: "删除失败",
    en: "Delete failed",
    th: "ลบล้มเหลว",
  },
  "error.otherMarketDestination": {
    zh: "OTHER 市场请填写目的地",
    en: "Please enter a destination for OTHER market",
    th: "ตลาด OTHER กรุณากรอกปลายทาง",
  },
  "error.minQuantity": {
    zh: "请至少填写一个收货人的桶数",
    en: "Please enter at least one quantity",
    th: "กรุณากรอกจำนวนลังอย่างน้อยหนึ่งรายการ",
  },
  "error.sessionNotFound": {
    zh: "进货单不存在",
    en: "Session not found",
    th: "ไม่พบรายการนำเข้า",
  },
  "error.cannotRevertDispatched": {
    zh: "已派车的进货单不能改回草稿",
    en: "Cannot revert dispatched inbound to draft",
    th: "รายการที่จัดรถแล้วเปลี่ยนกลับเป็นฉบับร่างไม่ได้",
  },
  "error.shipperNotFound": {
    zh: "寄货人不存在",
    en: "Shipper not found",
    th: "ไม่พบผู้ส่ง",
  },
  "error.sessionNoFailed": {
    zh: "无法生成唯一进货编号",
    en: "Failed to generate unique session number",
    th: "สร้างเลขที่นำเข้าไม่สำเร็จ",
  },
  "error.invalidPickup": {
    zh: "无效的收货地点",
    en: "Invalid pickup location",
    th: "จุดรับสินค้าไม่ถูกต้อง",
  },
  "freight.title": {
    zh: "车力信息",
    en: "Freight Details",
    th: "ข้อมูลค่าขนส่ง",
  },
  "freight.visibleNote": {
    zh: "仅 Admin / Accounting / Owner 可见。Operation 角色不可见此区域。",
    en: "",
    th: "เฉพาะ Admin / Accounting / Owner เท่านั้นที่เห็นได้ บทบาท Operation ไม่เห็นส่วนนี้",
  },
  "freight.payer": {
    zh: "付款方",
    en: "Payer",
    th: "ผู้ชำระ",
  },
  "freight.mode": {
    zh: "付款模式",
    en: "Mode",
    th: "รูปแบบการชำระ",
  },
  "freight.rate": {
    zh: "费率/桶",
    en: "Rate",
    th: "อัตรา/ลัง",
  },
  "freight.amount": {
    zh: "车力金额",
    en: "Amount",
    th: "ค่าขนส่ง",
  },
  "freight.currency": {
    zh: "币种",
    en: "Curr.",
    th: "สกุลเงิน",
  },
  "freight.billing": {
    zh: "开单公司",
    en: "Billing",
    th: "บริษัทออกบิล",
  },
  "freight.consignee": {
    zh: "收货人",
    en: "Consignee",
    th: "ผู้รับ",
  },
  "freight.shipper": {
    zh: "寄货人",
    en: "Shipper",
    th: "ผู้ส่ง",
  },
  "freight.myRate": {
    zh: "MY段费率",
    en: "",
    th: "อัตราช่วง MY",
  },
  "freight.myAmount": {
    zh: "MY段金额",
    en: "",
    th: "ยอดช่วง MY",
  },
  "freight.thRate": {
    zh: "泰国段费率",
    en: "",
    th: "อัตราช่วงไทย",
  },
  "freight.thAmount": {
    zh: "泰国段金额",
    en: "",
    th: "ยอดช่วงไทย",
  },
  "mode.1a": {
    zh: "1a 寄货人付 THB",
    en: "",
    th: "1a ผู้ส่งจ่าย THB",
  },
  "mode.1b": {
    zh: "1b 寄货人付 MYR",
    en: "",
    th: "1b ผู้ส่งจ่าย MYR",
  },
  "mode.2": {
    zh: "2 收货人付",
    en: "Consignee pays",
    th: "2 ผู้รับจ่าย",
  },
  "mode.3": {
    zh: "3 其他",
    en: "Other",
    th: "3 อื่นๆ",
  },
  "common.back": {
    zh: "返回",
    en: "Back",
    th: "กลับ",
  },
  "common.print": {
    zh: "打印",
    en: "Print",
    th: "พิมพ์",
  },
  "common.downloadPdf": {
    zh: "下载 PDF",
    en: "Download PDF",
    th: "ดาวน์โหลด PDF",
  },
  "common.processing": {
    zh: "处理中…",
    en: "Processing…",
    th: "กำลังดำเนินการ…",
  },
  "common.retry": {
    zh: "重试",
    en: "Retry",
    th: "ลองใหม่",
  },
  "error.loadFailed": {
    zh: "加载失败，请稍后重试",
    en: "Failed to load data",
    th: "โหลดข้อมูลล้มเหลว กรุณาลองใหม่ภายหลัง",
  },
  "error.pageLoadFailed": {
    zh: "页面加载失败",
    en: "Page load failed",
    th: "โหลดหน้าล้มเหลว",
  },
  "dispatch.pageTitle": {
    zh: "派车调度",
    en: "Dispatch",
    th: "จัดรถ",
  },
  "dispatch.matrixSubtitle": {
    zh: "今日未分配货物矩阵",
    en: "Unassigned cargo matrix",
    th: "ตารางสินค้าที่ยังไม่จัดรถ (วันนี้)",
  },
  "dispatch.new": {
    zh: "新建派车单",
    en: "New Dispatch",
    th: "สร้างใบจัดรถ",
  },
  "dispatch.newSubtitle": {
    zh: "选择车辆、目的市场并勾选货物",
    en: "Select truck, markets and cargo",
    th: "เลือกรถ ตลาดปลายทาง และเลือกสินค้า",
  },
  "dispatch.edit": {
    zh: "编辑派车单",
    en: "Edit Dispatch",
    th: "แก้ไขใบจัดรถ",
  },
  "dispatch.matrixConsignorArea": {
    zh: "寄货人 / 地区",
    en: "Consignor / Area",
    th: "ผู้ส่ง / เขตพื้นที่",
  },
  "dispatch.marketTotals": {
    zh: "各市场总计",
    en: "Market Totals",
    th: "รวมแต่ละตลาด",
  },
  "dispatch.klMcPrintTitle": {
    zh: "派车汇总 KL–MC",
    en: "Dispatch summary KL–MC",
    th: "Dispatch summary KL–MC",
  },
  "dispatch.printKlMc": {
    zh: "打印 KL-MC",
    en: "Print KL-MC",
    th: "Print KL-MC",
  },
  "dispatch.noUnassignedCargo": {
    zh: "暂无未分配货物",
    en: "No unassigned cargo",
    th: "ไม่มีสินค้าที่ยังไม่จัดรถ",
  },
  "dispatch.todayOrders": {
    zh: "今日派车单",
    en: "Today's Dispatch Orders",
    th: "ใบจัดรถวันนี้",
  },
  "dispatch.doNo": {
    zh: "派车单号",
    en: "DO No.",
    th: "เลขที่ใบจัดรถ",
  },
  "dispatch.plateField": {
    zh: "车牌",
    en: "Plate",
    th: "ทะเบียนรถ",
  },
  "dispatch.driver": {
    zh: "司机",
    en: "Driver",
    th: "คนขับ",
  },
  "dispatch.markets": {
    zh: "市场",
    en: "Markets",
    th: "ตลาด",
  },
  "dispatch.load": {
    zh: "装载",
    en: "Load",
    th: "บรรทุก",
  },
  "dispatch.changeTruck": {
    zh: "换车",
    en: "Change",
    th: "เปลี่ยนรถ",
  },
  "dispatch.status.dispatched": {
    zh: "已派车",
    en: "Dispatched",
    th: "จัดรถแล้ว",
  },
  "dispatch.status.cancelled": {
    zh: "已取消",
    en: "Cancelled",
    th: "ยกเลิกแล้ว",
  },
  "dispatch.cancelTitle": {
    zh: "取消派车单",
    en: "Cancel Dispatch",
    th: "ยกเลิกใบจัดรถ",
  },
  "dispatch.cancelConfirm": {
    zh: "确认取消此派车单？桶数将退回未分配。",
    en: "Cancel this dispatch order? Crates return to unassigned.",
    th: "ยืนยันยกเลิกใบจัดรถนี้? จำนวนลังจะถูกคืนกลับเป็นยังไม่จัดรถ",
  },
  "dispatch.confirmCancel": {
    zh: "确认取消",
    en: "Confirm",
    th: "ยืนยันยกเลิก",
  },
  "dispatch.changeTruckTitle": {
    zh: "换车",
    en: "Change Truck",
    th: "เปลี่ยนรถ",
  },
  "dispatch.changeTruckDesc": {
    zh: "选择新车牌，桶数与市场分配保持不变。",
    en: "Select a new plate; crate counts and market allocation stay the same.",
    th: "เลือกทะเบียนรถใหม่ จำนวนลังและการแบ่งตลาดคงเดิม",
  },
  "dispatch.confirmChangeTruck": {
    zh: "确认换车",
    en: "Confirm",
    th: "ยืนยันเปลี่ยนรถ",
  },
  "dispatch.selectPlate": {
    zh: "— 选择车牌 —",
    en: "— Select —",
    th: "— เลือกทะเบียนรถ —",
  },
  "dispatch.selectDriver": {
    zh: "— 选择司机 —",
    en: "— Select —",
    th: "— เลือกคนขับ —",
  },
  "dispatch.destinationMarkets": {
    zh: "目的市场",
    en: "Markets",
    th: "ตลาดปลายทาง",
  },
  "dispatch.selectCargo": {
    zh: "勾选货物",
    en: "Select Cargo",
    th: "เลือกสินค้า",
  },
  "dispatch.cargoHint": {
    zh: "仅显示今日未分配货物",
    en: "Unassigned cargo for this date only",
    th: "แสดงเฉพาะสินค้าที่ยังไม่จัดรถของวันนี้",
  },
  "dispatch.selectAll": {
    zh: "全选",
    en: "Select All",
    th: "เลือกทั้งหมด",
  },
  "dispatch.deselectAll": {
    zh: "全不选",
    en: "Deselect All",
    th: "ยกเลิกเลือกทั้งหมด",
  },
  "dispatch.mcMarkThirdParty": {
    zh: "勾选的 MC 全转第三方",
    en: "Mark selected MC as third-party",
    th: "เปลี่ยน MC ที่เลือกทั้งหมดเป็นบุคคลที่สาม",
  },
  "dispatch.mcMarkSelf": {
    zh: "全部改回自送",
    en: "Mark all back to self-delivery",
    th: "เปลี่ยนกลับเป็นส่งเองทั้งหมด",
  },
  "dispatch.loadingCargo": {
    zh: "加载中…",
    en: "Loading…",
    th: "กำลังโหลด…",
  },
  "dispatch.noCargoForMarkets": {
    zh: "所选市场暂无未分配货物",
    en: "No unassigned cargo for selected markets",
    th: "ไม่มีสินค้าที่ยังไม่จัดรถในตลาดที่เลือก",
  },
  "dispatch.split": {
    zh: "拆分",
    en: "Split",
    th: "แยก",
  },
  "dispatch.unsplit": {
    zh: "取消拆分",
    en: "Unsplit",
    th: "ยกเลิกแยก",
  },
  "dispatch.selfDelivery": {
    zh: "自送",
    en: "Self",
    th: "ส่งเอง",
  },
  "dispatch.thirdParty": {
    zh: "转第三方",
    en: "Third-party",
    th: "บุคคลที่สาม",
  },
  "dispatch.totalQty": {
    zh: "共 {qty}",
    en: "Total {qty}",
    th: "รวม {qty}",
  },
  "dispatch.thisTruck": {
    zh: "此车:",
    en: "This truck:",
    th: "รถคันนี้:",
  },
  "dispatch.remaining": {
    zh: "剩余: {remaining}",
    en: "Remaining: {remaining}",
    th: "คงเหลือ: {remaining}",
  },
  "dispatch.loaded": {
    zh: "已装",
    en: "Loaded",
    th: "บรรทุกแล้ว",
  },
  "dispatch.overload": {
    zh: "超载",
    en: "Overload",
    th: "บรรทุกเกิน",
  },
  "dispatch.nearFull": {
    zh: "接近满载",
    en: "Near full",
    th: "ใกล้เต็ม",
  },
  "dispatch.confirmEdit": {
    zh: "确认修改",
    en: "Confirm",
    th: "ยืนยันแก้ไข",
  },
  "dispatch.confirmDispatch": {
    zh: "确认派车",
    en: "Confirm Dispatch",
    th: "ยืนยันจัดรถ",
  },
  "dispatch.error.cancelFailed": {
    zh: "取消失败",
    en: "Cancel failed",
    th: "ยกเลิกล้มเหลว",
  },
  "dispatch.error.changeFailed": {
    zh: "换车失败",
    en: "Change failed",
    th: "เปลี่ยนรถล้มเหลว",
  },
  "dispatch.error.invalidSplit": {
    zh: "拆分数量无效",
    en: "Invalid split quantity",
    th: "จำนวนแยกไม่ถูกต้อง",
  },
  "dispatch.error.splitExceeds": {
    zh: "{shipper} {stall} 此车数量不能超过 {max}",
    en: "{shipper} {stall} qty on this truck cannot exceed {max}",
    th: "{shipper} {stall} จำนวนของรถคันนี้ต้องไม่เกิน {max}",
  },
  "dispatch.error.invalidAssignQty": {
    zh: "分配数量无效",
    en: "Invalid assignment quantity",
    th: "จำนวนที่จัดไม่ถูกต้อง",
  },
  "dispatch.error.assignExceedsAvailable": {
    zh: "分配数量不能超过可用数量 {n}",
    en: "Cannot assign more than available quantity {n}",
    th: "จำนวนที่จัดต้องไม่เกินจำนวนที่มี {n}",
  },
  "dispatch.error.cargoUnavailableAssigned": {
    zh: "所选货物不可用或已被分配",
    en: "Selected cargo unavailable or already assigned",
    th: "สินค้าที่เลือกใช้ไม่ได้หรือถูกจัดไปแล้ว",
  },
  "dispatch.error.noMarket": {
    zh: "请至少选择一个目的市场",
    en: "Select at least one destination market",
    th: "กรุณาเลือกตลาดปลายทางอย่างน้อยหนึ่งแห่ง",
  },
  "dispatch.error.noCargo": {
    zh: "请至少勾选一项货物",
    en: "Please select at least one cargo item",
    th: "กรุณาเลือกสินค้าอย่างน้อยหนึ่งรายการ",
  },
  "dispatch.error.cargoUnavailable": {
    zh: "所选货物不可用",
    en: "Selected cargo unavailable",
    th: "สินค้าที่เลือกใช้ไม่ได้",
  },
  "dispatch.error.truckNotFound": {
    zh: "车辆不存在",
    en: "Truck not found",
    th: "ไม่พบรถ",
  },
  "dispatch.error.orderNotFound": {
    zh: "派车单不存在",
    en: "Dispatch order not found",
    th: "ไม่พบใบจัดรถ",
  },
  "dispatch.error.alreadyCancelled": {
    zh: "派车单已取消",
    en: "Dispatch order already cancelled",
    th: "ใบจัดรถถูกยกเลิกแล้ว",
  },
  "dispatch.error.cannotChangeCancelled": {
    zh: "已取消的派车单无法换车",
    en: "Cannot change truck on cancelled order",
    th: "ใบจัดรถที่ยกเลิกแล้วไม่สามารถเปลี่ยนรถได้",
  },
  "crateExport.pageSubtitle": {
    zh: "泰国车空桶归还录入及泰文收据",
    en: "TH vehicle empty crate return & receipt",
    th: "บันทึกคืนลังเปล่าของรถไทยและพิมพ์ใบรับ",
  },
  "crateExport.todayReturns": {
    zh: "今日归还单",
    en: "Today's Returns",
    th: "ใบคืนลังวันนี้",
  },
  "crateExport.listHint": {
    zh: "按日期查看已录入归还单",
    en: "View saved returns by date",
    th: "ดูใบคืนลังที่บันทึกไว้ตามวันที่",
  },
  "crateExport.editTitle": {
    zh: "编辑归还单",
    en: "Edit Export",
    th: "แก้ไขใบคืนลัง",
  },
  "crateExport.editSubtitle": {
    zh: "{exportNo} · 寄货人/日期不可改",
    en: "{exportNo} · Consignor & date locked",
    th: "{exportNo} · ผู้ส่งและวันที่แก้ไขไม่ได้",
  },
  "crateExport.backToList": {
    zh: "返回列表",
    en: "Back to list",
    th: "กลับไปที่รายการ",
  },
  "crateExport.receiptTitle": {
    zh: "空桶收据",
    en: "Empty Crate Receipt",
    th: "ใบรับคืนลังเปล่า",
  },
  "crateExport.location": {
    zh: "产地",
    en: "Location",
    th: "แหล่งที่มา",
  },
  "crateExport.locationPlaceholder": {
    zh: "如 PHUKET、TOT",
    en: "e.g. PHUKET, TOT",
    th: "เช่น PHUKET, TOT",
  },
  "crateExport.suggested": {
    zh: "系统建议",
    en: "Suggested",
    th: "ระบบแนะนำ",
  },
  "crateExport.sadaoStock": {
    zh: "SADAO现货",
    en: "Stock",
    th: "สต๊อก SADAO",
  },
  "crateExport.actual": {
    zh: "实际给出",
    en: "Actual",
    th: "จ่ายจริง",
  },
  "crateExport.shortage": {
    zh: "欠桶",
    en: "Shortage",
    th: "ค้างลัง",
  },
  "crateExport.saveChanges": {
    zh: "保存修改",
    en: "Save Changes",
    th: "บันทึกการแก้ไข",
  },
  "crateExport.confirmExport": {
    zh: "确认归还",
    en: "Confirm Export",
    th: "ยืนยันคืนลัง",
  },
  "crateExport.emptyList": {
    zh: "该日暂无归还单",
    en: "No crate exports for this date",
    th: "ยังไม่มีใบคืนลังในวันที่นี้",
  },
  "crateExport.teNo": {
    zh: "TE 号",
    en: "TE No.",
    th: "เลขที่ TE",
  },
  "crateExport.shortageBadge": {
    zh: "欠 {n}",
    en: "Short {n}",
    th: "ค้าง {n}",
  },
  "crateExport.reprint": {
    zh: "重打",
    en: "Reprint",
    th: "พิมพ์ซ้ำ",
  },
  "crateExport.void": {
    zh: "作废",
    en: "Void",
    th: "ยกเลิก",
  },
  "crateExport.voidSuccess": {
    zh: "归还单 {exportNo} 已作废",
    en: "Export {exportNo} voided",
    th: "ยกเลิกใบคืนลัง {exportNo} แล้ว",
  },
  "crateExport.updateSuccess": {
    zh: "归还单 {exportNo} 已更新",
    en: "Export {exportNo} updated",
    th: "อัปเดตใบคืนลัง {exportNo} แล้ว",
  },
  "crateExport.voidTitle": {
    zh: "作废归还单",
    en: "Void Export",
    th: "ยกเลิกใบคืนลัง",
  },
  "crateExport.voidConfirm": {
    zh: "确认作废此归还单？将退回客户桶库存。",
    en: "—",
    th: "ยืนยันยกเลิกใบคืนลังนี้? จำนวนลังจะถูกคืนกลับเข้าสต๊อกของลูกค้า",
  },
  "crateExport.confirmVoid": {
    zh: "确认作废",
    en: "Confirm Void",
    th: "ยืนยันยกเลิก",
  },
  "crateExport.error.thPlateRequired": {
    zh: "请填写泰国车牌",
    en: "Please enter TH plate",
    th: "กรุณากรอกทะเบียนรถไทย",
  },
  "crateExport.error.voidFailed": {
    zh: "作废失败",
    en: "Void failed",
    th: "ยกเลิกล้มเหลว",
  },
  "crateExport.error.minLines": {
    zh: "请至少填写一行归还数据",
    en: "Please enter at least one return line",
    th: "กรุณากรอกข้อมูลการคืนอย่างน้อยหนึ่งรายการ",
  },
  "crateExport.error.invalidExportNo": {
    zh: "归还单号无效",
    en: "Invalid export number",
    th: "เลขที่ใบคืนลังไม่ถูกต้อง",
  },
  "crateExport.error.notFound": {
    zh: "归还单不存在",
    en: "Export not found",
    th: "ไม่พบใบคืนลัง",
  },
  "crateImport.pageSubtitle": {
    zh: "马来西亚车回程空桶回收录入",
    en: "MY truck return crate collection",
    th: "บันทึกรับลังเปล่ารถมาเลเซียขากลับ",
  },
  "crateImport.todaySection": {
    zh: "当日记录",
    en: "Today",
    th: "บันทึกวันนี้",
  },
  "crateImport.sourceMarket": {
    zh: "来源市场",
    en: "Market",
    th: "ตลาดต้นทาง",
  },
  "crateImport.addColumn": {
    zh: "加列",
    en: "Add column",
    th: "เพิ่มคอลัมน์",
  },
  "crateImport.otherColumnHint": {
    zh: "备注，不计入库存",
    en: "Notes only, not counted in stock",
    th: "หมายเหตุ ไม่นับเข้าสต๊อก",
  },
  "crateImport.removeColumnAria": {
    zh: "删除列 {name}",
    en: "Remove column {name}",
    th: "ลบคอลัมน์ {name}",
  },
  "crateImport.addRow": {
    zh: "加一行",
    en: "Add Row",
    th: "เพิ่มแถว",
  },
  "crateImport.confirmSave": {
    zh: "确认保存",
    en: "Confirm Save",
    th: "ยืนยันบันทึก",
  },
  "crateImport.status.onTheWay": {
    zh: "在途",
    en: "In transit",
    th: "ระหว่างทาง",
  },
  "crateImport.status.arrived": {
    zh: "已到",
    en: "Arrived",
    th: "มาถึงแล้ว",
  },
  "crateImport.inTransitTitle": {
    zh: "仍在途中",
    en: "In Transit",
    th: "ยังอยู่ระหว่างทาง",
  },
  "crateImport.inTransitCount": {
    zh: "{n} 辆车仍在途中",
    en: "{n} trucks in transit",
    th: "มี {n} คันยังอยู่ระหว่างทาง",
  },
  "crateImport.saveSuccess": {
    zh: "保存成功，SADAO 库存已更新",
    en: "Saved — SADAO stock updated",
    th: "บันทึกแล้ว อัปเดตสต๊อก SADAO",
  },
  "crateImport.addColumnTitle": {
    zh: "添加桶型列",
    en: "Add Crate Column",
    th: "เพิ่มคอลัมน์ประเภทลัง",
  },
  "crateImport.selectCrateType": {
    zh: "选择桶型",
    en: "Select crate type",
    th: "เลือกประเภทลัง",
  },
  "crateImport.error.noMoreTypes": {
    zh: "没有可添加的桶型",
    en: "No more crate types to add",
    th: "ไม่มีประเภทลังให้เพิ่มแล้ว",
  },
  "crateImport.error.columnExists": {
    zh: "列已存在: {code}",
    en: "Column already exists: {code}",
    th: "มีคอลัมน์นี้แล้ว: {code}",
  },
  "crateImport.error.updateFailed": {
    zh: "更新失败",
    en: "Update failed",
    th: "อัปเดตล้มเหลว",
  },
  "crateImport.error.plateNotFound": {
    zh: "车牌不存在: {plate}",
    en: "Unknown plate: {plate}",
    th: "ไม่พบทะเบียนรถ: {plate}",
  },
  "crateImport.error.invalidMarket": {
    zh: "市场代码无效: {code}",
    en: "Invalid market: {code}",
    th: "รหัสตลาดไม่ถูกต้อง: {code}",
  },
  "crateStock.pageSubtitle": {
    zh: "SADAO实时库存、欠桶记录及流水",
    en: "SADAO live stock, shortages & ledger",
    th: "สต๊อก SADAO แบบเรียลไทม์ รายการค้างลัง และความเคลื่อนไหว",
  },
  "crateStock.sadaoStockTitle": {
    zh: "SADAO 实时库存",
    en: "SADAO Stock",
    th: "สต๊อก SADAO ปัจจุบัน",
  },
  "crateStock.stock": {
    zh: "SADAO库存",
    en: "Stock",
    th: "สต๊อก",
  },
  "crateStock.todayIn": {
    zh: "今日 IN",
    en: "Today IN",
    th: "เข้าวันนี้",
  },
  "crateStock.todayOut": {
    zh: "今日 OUT",
    en: "Today OUT",
    th: "ออกวันนี้",
  },
  "crateStock.shortageTitle": {
    zh: "欠桶记录",
    en: "Shortage Records",
    th: "รายการค้างลัง",
  },
  "crateStock.shortageQty": {
    zh: "欠桶数",
    en: "Qty",
    th: "จำนวนค้าง",
  },
  "crateStock.receiptNo": {
    zh: "收据 No.",
    en: "Receipt No.",
    th: "เลขที่ใบรับ",
  },
  "crateStock.ledgerTitle": {
    zh: "每日流水",
    en: "Ledger",
    th: "ความเคลื่อนไหวรายวัน",
  },
  "crateStock.emptyLedger": {
    zh: "暂无流水记录",
    en: "No ledger records",
    th: "ไม่มีรายการเคลื่อนไหว",
  },
  "crateStock.type": {
    zh: "类型",
    en: "Type",
    th: "ประเภท",
  },
  "crateStock.party": {
    zh: "市场/寄货人",
    en: "Party",
    th: "ตลาด/ผู้ส่ง",
  },
  "crateStock.balance": {
    zh: "余额",
    en: "Balance",
    th: "คงเหลือ",
  },
  "crateStock.ledger.in": {
    zh: "IN",
    en: "IN",
    th: "เข้า",
  },
  "crateStock.ledger.out": {
    zh: "OUT",
    en: "OUT",
    th: "ออก",
  },
  "crateStock.ledger.adj": {
    zh: "调整",
    en: "ADJ",
    th: "ปรับ",
  },
  "crateStock.editTitle": {
    zh: "编辑关口库存 — {code}",
    en: "Edit SADAO Stock — {code}",
    th: "แก้ไขสต๊อกด่าน — {code}",
  },
  "crateStock.adjustmentDefaultNotes": {
    zh: "期初盘点 / 桶库存创立于24/6/26",
    en: "Opening stocktake / crate stock established 24/6/26",
    th: "นับสต๊อกตั้งต้น / เริ่มบันทึกสต๊อกลัง 24/6/26",
  },
  "crateStock.adjustmentParty": {
    zh: "盘点",
    en: "Adjustment",
    th: "ปรับสต๊อก",
  },
  "crateStock.targetQty": {
    zh: "目标库存",
    en: "Target stock",
    th: "สต๊อกเป้าหมาย",
  },
  "crateStock.error.invalidQty": {
    zh: "数量无效",
    en: "Invalid quantity",
    th: "จำนวนไม่ถูกต้อง",
  },
  "customerCrateStock.pageSubtitle": {
    zh: "各寄货人桶型库存管理",
    en: "Per-shipper crate inventory",
    th: "จัดการสต๊อกลังแยกตามผู้ส่ง",
  },
  "customerCrateStock.searchShipper": {
    zh: "搜索寄货人",
    en: "Search shipper",
    th: "ค้นหาผู้ส่ง",
  },
  "customerCrateStock.hint": {
    zh: "欠桶（负数）以红色显示 · 点击行首展开各产地明细",
    en: "Shortage (negative) shown in red · click row to expand by location",
    th: "ค้างลัง (ติดลบ) แสดงเป็นสีแดง · คลิกแถวเพื่อดูรายละเอียดแยกแหล่งที่มา",
  },
  "customerCrateStock.emptySearch": {
    zh: "无匹配寄货人",
    en: "No shippers found",
    th: "ไม่พบผู้ส่งที่ตรงกัน",
  },
  "customerCrateStock.expandAria": {
    zh: "展开产地明细",
    en: "Expand by location",
    th: "ดูรายละเอียดแยกแหล่งที่มา",
  },
  "customerCrateStock.noLocationBreakdown": {
    zh: "暂无产地明细",
    en: "No location breakdown",
    th: "ไม่มีรายละเอียดแหล่งที่มา",
  },
  "customerCrateStock.unspecifiedLocation": {
    zh: "未注明",
    en: "Unspecified",
    th: "ไม่ระบุ",
  },
  "customerCrateStock.editTitle": {
    zh: "编辑库存 — {shipperName}",
    en: "Edit Stock — {shipperName}",
    th: "แก้ไขสต๊อก — {shipperName}",
  },
  "customerCrateStock.error.invalidQty": {
    zh: "桶型 {code} 数量无效",
    en: "Invalid quantity for {code}",
    th: "จำนวนประเภทลัง {code} ไม่ถูกต้อง",
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
