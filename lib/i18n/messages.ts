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
  "charter.monthlyLedger.title": {
    zh: "当月包车流水",
    en: "Monthly charter ledger",
    th: "บัญชีเหมารถประจำเดือน",
  },
  "charter.monthlyLedger.subtitle": {
    zh: "按包车单日期筛选；金额与 P&L 包车行一致",
    en: "Filter by charter date; amounts match P&L charter rows",
    th: "กรองตามวันที่เหมารถ ยอดตรงกับแถว P&L",
  },
  "charter.monthlyLedger.loading": {
    zh: "加载中…",
    en: "Loading…",
    th: "กำลังโหลด…",
  },
  "charter.monthlyLedger.loadFailed": {
    zh: "加载失败",
    en: "Failed to load",
    th: "โหลดไม่สำเร็จ",
  },
  "charter.monthlyLedger.empty": {
    zh: "该月暂无包车记录",
    en: "No charter trips for this month",
    th: "ไม่มีรายการเหมารถในเดือนนี้",
  },
  "charter.monthlyLedger.filtersChanged": {
    zh: "月份已变更，请点击查询更新",
    en: "Month changed — click Search to update",
    th: "เปลี่ยนเดือนแล้ว กดค้นหาเพื่ออัปเดต",
  },
  "charter.monthlyLedger.col.date": {
    zh: "日期",
    en: "Date",
    th: "วันที่",
  },
  "charter.monthlyLedger.col.charterNo": {
    zh: "包车单号",
    en: "Charter no.",
    th: "เลขที่เหมา",
  },
  "charter.monthlyLedger.col.plate": {
    zh: "车牌",
    en: "Plate",
    th: "ทะเบียน",
  },
  "charter.monthlyLedger.col.customer": {
    zh: "客户",
    en: "Customer",
    th: "ลูกค้า",
  },
  "charter.monthlyLedger.col.location": {
    zh: "路线/地点",
    en: "Route / location",
    th: "เส้นทาง/สถานที่",
  },
  "charter.monthlyLedger.col.revenue": {
    zh: "总价",
    en: "Revenue",
    th: "รายได้",
  },
  "charter.monthlyLedger.col.grossProfit": {
    zh: "毛利",
    en: "Gross profit",
    th: "กำไรขั้นต้น",
  },
  "nav.summary": {
    zh: "总单",
    en: "Daily Summary",
    th: "สรุปประจำวัน",
  },
  "nav.search": {
    zh: "查询",
    en: "Search",
    th: "ค้นหา",
  },
  "nav.financialControl": {
    zh: "财务管控",
    en: "Financial Control",
    th: "การควบคุมทางการเงิน",
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
  "nav.invoiceCollections": {
    zh: "Invoice 收账",
    en: "Invoice Collections",
    th: "เก็บเงินใบแจ้งหนี้",
  },
  "nav.bankReconciliation": {
    zh: "银行对账",
    en: "Bank Reconciliation",
    th: "กระทบยอดธนาคาร",
  },
  "nav.autocountExport": {
    zh: "AutoCount 导出",
    en: "AutoCount Export",
    th: "ส่งออก AutoCount",
  },
  "bankReconciliation.pageSubtitle": {
    zh: "按银行账户核对系统收款与银行对账单",
    en: "Match system receipts to bank statements by account",
    th: "กระทบยอดรับเงินกับใบแจ้งยอดธนาคารตามบัญชี",
  },
  "bankReconciliation.dateFrom": {
    zh: "起始日期",
    en: "From",
    th: "ตั้งแต่",
  },
  "bankReconciliation.dateTo": {
    zh: "结束日期",
    en: "To",
    th: "ถึง",
  },
  "bankReconciliation.thisMonth": {
    zh: "本月",
    en: "This month",
    th: "เดือนนี้",
  },
  "bankReconciliation.exportCsv": {
    zh: "导出 CSV",
    en: "Export CSV",
    th: "ส่งออก CSV",
  },
  "bankReconciliation.groupCount": {
    zh: "{n} 笔",
    en: "{n} payments",
    th: "{n} รายการ",
  },
  "bankReconciliation.reconciledSubtotal": {
    zh: "已对账",
    en: "Reconciled",
    th: "กระทบยอดแล้ว",
  },
  "bankReconciliation.emptyGroup": {
    zh: "该账户在此期间无收款",
    en: "No receipts for this account in the selected range",
    th: "ไม่มีรายการรับเงินในช่วงนี้",
  },
  "bankReconciliation.groupTotal": {
    zh: "小计",
    en: "Subtotal",
    th: "รวม",
  },
  "bankReconciliation.col.reconciled": {
    zh: "已对账",
    en: "Done",
    th: "กระทบยอด",
  },
  "bankReconciliation.col.date": {
    zh: "日期",
    en: "Date",
    th: "วันที่",
  },
  "bankReconciliation.col.customer": {
    zh: "客户",
    en: "Customer",
    th: "ลูกค้า",
  },
  "bankReconciliation.col.amount": {
    zh: "金额",
    en: "Amount",
    th: "จำนวนเงิน",
  },
  "bankReconciliation.col.invoiceNos": {
    zh: "发票号",
    en: "Invoice nos",
    th: "เลขใบแจ้งหนี้",
  },

  "invoiceCollections.title": {
    zh: "Invoice 收账",
    en: "Invoice Collections",
    th: "เก็บเงินใบแจ้งหนี้",
  },
  "invoiceCollections.subtitle": {
    zh: "客户应收账本 · 来款录入与自动 FIFO 冲账",
    en: "Customer receivable ledger · payment entry with automatic FIFO allocation",
    th: "บัญชีลูกหนี้ · บันทึกรับเงินและจัดสรร FIFO อัตโนมัติ",
  },
  "invoiceCollections.overview.thb": {
    zh: "THB 总应收",
    en: "THB total receivable",
    th: "ลูกหนี้รวม THB",
  },
  "invoiceCollections.overview.myr": {
    zh: "MYR 总应收",
    en: "MYR total receivable",
    th: "ลูกหนี้รวม MYR",
  },
  "invoiceCollections.overview.bankAccountsPending": {
    zh: "户口入账统计将在录款功能上线后提供",
    en: "Bank account breakdown will be available after payment entry is implemented",
    th: "สรุปตามบัญชีธนาคารจะมีหลังเปิดรับบันทึกการรับเงิน",
  },
  "invoiceCollections.overview.thbTitle": {
    zh: "THB 收账总览",
    en: "THB collections overview",
    th: "สรุปเก็บเงิน THB",
  },
  "invoiceCollections.overview.myrTitle": {
    zh: "MYR 收账总览",
    en: "MYR collections overview",
    th: "สรุปเก็บเงิน MYR",
  },
  "invoiceCollections.overview.scopeHint": {
    zh: "按上方月份范围统计（不受下方列表筛选影响）",
    en: "Totals for the month range above (not affected by list filters below)",
    th: "รวมตามช่วงเดือนด้านบน (ไม่ถูกตัวกรองรายการด้านล่าง)",
  },
  "invoiceCollections.overview.metricsLegend": {
    zh: "总已收 = 实际来款合计；已分配 = 冲账金额；预收 = 未分配来款；总未收 = 总应收 − 已分配（不含预收）",
    en: "Received = sum of payments; Allocated = applied to invoices; Prepaid = unallocated payments; Open = receivable − allocated (excludes prepaid)",
    th: "รับแล้ว = ยอดรับเงิน; จัดสรรแล้ว = หักใบแจ้งหนี้; รับล่วงหน้า = เงินคงเหลือ; ค้าง = ลูกหนี้ − จัดสรรแล้ว (ไม่รวมรับล่วงหน้า)",
  },
  "invoiceCollections.overview.totalReceivable": {
    zh: "总应收",
    en: "Total receivable",
    th: "ลูกหนี้รวม",
  },
  "invoiceCollections.overview.totalReceived": {
    zh: "总已收（收到的钱）",
    en: "Total received (cash in)",
    th: "รับแล้วรวม (เงินเข้า)",
  },
  "invoiceCollections.overview.totalAllocated": {
    zh: "已分配（已冲账）",
    en: "Allocated (applied)",
    th: "จัดสรรแล้ว (หักแล้ว)",
  },
  "invoiceCollections.overview.totalPrepaid": {
    zh: "预收（未分配来款）",
    en: "Prepaid (unallocated)",
    th: "รับล่วงหน้า (ยังไม่จัดสรร)",
  },
  "invoiceCollections.overview.totalOpen": {
    zh: "总未收",
    en: "Total open",
    th: "ค้างรับรวม",
  },
  "invoiceCollections.overview.bankBreakdownTitle": {
    zh: "各户口入账",
    en: "Bank account receipts",
    th: "ยอดเข้าแต่ละบัญชี",
  },
  "invoiceCollections.overview.bankBreakdownHint": {
    zh: "按来款户口统计实际入账，与冲账无关",
    en: "Receipts by payment bank account; independent of allocation",
    th: "ยอดรับตามบัญชีที่รับเงิน ไม่เกี่ยวกับการจัดสรร",
  },
  "invoiceCollections.filters.title": {
    zh: "列表筛选",
    en: "List filters",
    th: "ตัวกรองรายการ",
  },
  "invoiceCollections.filters.scopeHint": {
    zh: "仅筛选下方客户账本列表；顶部总览仍按月份范围全量统计",
    en: "Filters the customer ledger list only; overview uses the full month range",
    th: "กรองเฉพาะรายการลูกหนี้ด้านล่าง สรุปด้านบนใช้ช่วงเดือนทั้งหมด",
  },
  "invoiceCollections.filters.reset": {
    zh: "重置筛选",
    en: "Reset filters",
    th: "ล้างตัวกรอง",
  },
  "invoiceCollections.filters.customer": {
    zh: "客户",
    en: "Customer",
    th: "ลูกค้า",
  },
  "invoiceCollections.filters.customerPlaceholder": {
    zh: "名称 / 代码 / 关键字",
    en: "Name / code / keyword",
    th: "ชื่อ / รหัส / คำค้น",
  },
  "invoiceCollections.filters.bankAccount": {
    zh: "来款户口",
    en: "Payment bank account",
    th: "บัญชีรับเงิน",
  },
  "invoiceCollections.filters.status": {
    zh: "收款状态",
    en: "Collection status",
    th: "สถานะการเก็บเงิน",
  },
  "invoiceCollections.filters.currency": {
    zh: "币种",
    en: "Currency",
    th: "สกุลเงิน",
  },
  "invoiceCollections.filters.all": {
    zh: "全部",
    en: "All",
    th: "ทั้งหมด",
  },
  "invoiceCollections.filters.noResults": {
    zh: "没有符合筛选条件的客户账本",
    en: "No customer ledgers match the filters",
    th: "ไม่มีบัญชีลูกหนี้ที่ตรงกับตัวกรอง",
  },
  "invoiceCollections.col.customer": {
    zh: "客户",
    en: "Customer",
    th: "ลูกค้า",
  },
  "invoiceCollections.col.currency": {
    zh: "币种",
    en: "Currency",
    th: "สกุลเงิน",
  },
  "invoiceCollections.col.earliestMonth": {
    zh: "最早账单月",
    en: "Earliest invoice month",
    th: "เดือนใบแจ้งหนี้แรก",
  },
  "invoiceCollections.col.totalReceivable": {
    zh: "总应收",
    en: "Total receivable",
    th: "ลูกหนี้รวม",
  },
  "invoiceCollections.col.invoiceCount": {
    zh: "Invoice 张数",
    en: "Invoice count",
    th: "จำนวนใบแจ้งหนี้",
  },
  "invoiceCollections.col.received": {
    zh: "已收",
    en: "Received",
    th: "รับแล้ว",
  },
  "invoiceCollections.col.month": {
    zh: "月份",
    en: "Month",
    th: "เดือน",
  },
  "invoiceCollections.col.type": {
    zh: "类型",
    en: "Type",
    th: "ประเภท",
  },
  "invoiceCollections.col.invoiceNo": {
    zh: "Invoice 号",
    en: "Invoice no.",
    th: "เลขใบแจ้งหนี้",
  },
  "invoiceCollections.col.amount": {
    zh: "金额",
    en: "Amount",
    th: "จำนวนเงิน",
  },
  "invoiceCollections.col.collectionStatus": {
    zh: "收款状态",
    en: "Collection status",
    th: "สถานะการเก็บเงิน",
  },
  "invoiceCollections.status.unpaid": {
    zh: "未付",
    en: "Unpaid",
    th: "ยังไม่ชำระ",
  },
  "invoiceCollections.status.partial": {
    zh: "部分已付",
    en: "Partially paid",
    th: "ชำระบางส่วน",
  },
  "invoiceCollections.status.paid": {
    zh: "已付清",
    en: "Paid",
    th: "ชำระครบ",
  },
  "invoiceCollections.status.hasPrepayment": {
    zh: "有预收",
    en: "Prepaid balance",
    th: "มียอดรับล่วงหน้า",
  },
  "invoiceCollections.type.freight": {
    zh: "车力",
    en: "Freight",
    th: "ค่าขนส่ง",
  },
  "invoiceCollections.type.crateReturn": {
    zh: "回收桶",
    en: "Crate return",
    th: "คืนลัง",
  },
  "invoiceCollections.type.charter": {
    zh: "包车",
    en: "Charter",
    th: "เหมารถ",
  },
  "invoiceCollections.backToList": {
    zh: "返回客户列表",
    en: "Back to customer list",
    th: "กลับรายชื่อลูกค้า",
  },
  "invoiceCollections.detailTitle": {
    zh: "客户应收账本",
    en: "Customer receivable ledger",
    th: "บัญชีลูกหนี้ลูกค้า",
  },
  "invoiceCollections.empty": {
    zh: "所选月份范围内暂无 Invoice",
    en: "No invoices in the selected period",
    th: "ไม่มีใบแจ้งหนี้ในช่วงที่เลือก",
  },
  "invoiceCollections.openPrint": {
    zh: "查看打印",
    en: "Open print",
    th: "เปิดพิมพ์",
  },
  "invoiceCollections.loadFailed": {
    zh: "加载失败",
    en: "Failed to load",
    th: "โหลดไม่สำเร็จ",
  },
  "invoiceCollections.loadingDetail": {
    zh: "正在加载客户账本…",
    en: "Loading customer ledger…",
    th: "กำลังโหลดบัญชีลูกค้า…",
  },
  "invoiceCollections.awaitingQuery": {
    zh: "请选择月份范围并点击「查询」",
    en: "Select a month range and click Search",
    th: "เลือกช่วงเดือนแล้วกดค้นหา",
  },
  "invoiceCollections.payments.title": {
    zh: "来款",
    en: "Payments",
    th: "รับเงิน",
  },
  "invoiceCollections.payments.add": {
    zh: "录入来款",
    en: "Record payment",
    th: "บันทึกรับเงิน",
  },
  "invoiceCollections.payments.empty": {
    zh: "暂无来款记录",
    en: "No payments recorded",
    th: "ยังไม่มีการรับเงิน",
  },
  "invoiceCollections.payments.col.date": {
    zh: "日期",
    en: "Date",
    th: "วันที่",
  },
  "invoiceCollections.payments.col.bankAccount": {
    zh: "户口",
    en: "Bank account",
    th: "บัญชี",
  },
  "invoiceCollections.payments.col.amount": {
    zh: "金额",
    en: "Amount",
    th: "จำนวนเงิน",
  },
  "invoiceCollections.payments.col.allocated": {
    zh: "已分配",
    en: "Allocated",
    th: "จัดสรรแล้ว",
  },
  "invoiceCollections.payments.col.unallocated": {
    zh: "预收余额",
    en: "Unallocated",
    th: "ยอดคงเหลือ",
  },
  "invoiceCollections.payments.expandAllocations": {
    zh: "查看冲账明细",
    en: "View allocations",
    th: "ดูการจัดสรร",
  },
  "invoiceCollections.payments.dialogTitle": {
    zh: "录入来款",
    en: "Record payment",
    th: "บันทึกรับเงิน",
  },
  "invoiceCollections.payments.paymentDate": {
    zh: "付款日期",
    en: "Payment date",
    th: "วันที่รับเงิน",
  },
  "invoiceCollections.payments.notes": {
    zh: "备注",
    en: "Notes",
    th: "หมายเหตุ",
  },
  "invoiceCollections.payments.preview": {
    zh: "预览自动冲账",
    en: "Preview auto allocation",
    th: "ดูตัวอย่างการจัดสรร",
  },
  "invoiceCollections.payments.confirm": {
    zh: "确认保存",
    en: "Save payment",
    th: "บันทึก",
  },
  "invoiceCollections.payments.previewTitle": {
    zh: "拟分配结果",
    en: "Planned allocations",
    th: "ผลการจัดสรร",
  },
  "invoiceCollections.payments.openInvoices": {
    zh: "未清 Invoice（老→新）",
    en: "Open invoices (oldest first)",
    th: "ใบแจ้งหนี้ค้าง (เก่าสุดก่อน)",
  },
  "invoiceCollections.payments.saveSuccess": {
    zh: "来款已保存并完成自动冲账",
    en: "Payment saved and auto-allocated",
    th: "บันทึกและจัดสรรเรียบร้อย",
  },
  "invoiceCollections.payments.saveFailed": {
    zh: "保存失败",
    en: "Failed to save payment",
    th: "บันทึกไม่สำเร็จ",
  },
  "invoiceCollections.payments.edit": {
    zh: "改",
    en: "Edit",
    th: "แก้ไข",
  },
  "invoiceCollections.payments.delete": {
    zh: "删",
    en: "Delete",
    th: "ลบ",
  },
  "invoiceCollections.payments.manualAllocate": {
    zh: "手动冲账",
    en: "Manual allocate",
    th: "จัดสรรเอง",
  },
  "invoiceCollections.payments.resetAuto": {
    zh: "恢复自动",
    en: "Reset to auto",
    th: "กลับเป็นอัตโนมัติ",
  },
  "invoiceCollections.payments.editTitle": {
    zh: "修改来款",
    en: "Edit payment",
    th: "แก้ไขรับชำระ",
  },
  "invoiceCollections.payments.manualTitle": {
    zh: "手动指定冲账",
    en: "Manual allocation",
    th: "จัดสรรด้วยตนเอง",
  },
  "invoiceCollections.payments.deleteTitle": {
    zh: "删除来款",
    en: "Delete payment",
    th: "ลบรับชำระ",
  },
  "invoiceCollections.payments.deleteConfirm": {
    zh: "确定删除这笔来款？删除后将自动重算该客户账本的冲账。",
    en: "Delete this payment? Allocations for this customer ledger will be recalculated.",
    th: "ลบรายการนี้? ระบบจะคำนวณการจัดสรรใหม่",
  },
  "invoiceCollections.payments.resetAutoConfirm": {
    zh: "恢复自动冲账？将删除该笔来款的手动分配并重新 FIFO。",
    en: "Reset to auto allocation? Manual rows for this payment will be removed and FIFO rerun.",
    th: "กลับเป็นอัตโนมัติ? จะลบการจัดสรรด้วยตนเองและคำนวณ FIFO ใหม่",
  },
  "invoiceCollections.payments.manualSum": {
    zh: "手动冲账合计",
    en: "Manual total",
    th: "รวมจัดสรรด้วยตนเอง",
  },
  "invoiceCollections.payments.manualRemaining": {
    zh: "剩余未分配",
    en: "Remaining unallocated",
    th: "คงเหลือไม่จัดสรร",
  },
  "invoiceCollections.payments.overInvoiceWarning": {
    zh: "以下 Invoice 冲账将超过总额",
    en: "These invoices would be over-allocated",
    th: "ใบแจ้งหนี้เหล่านี้จะถูกจัดสรรเกินยอด",
  },
  "invoiceCollections.payments.confirmOverAllocation": {
    zh: "我确认仍要保存超额冲账",
    en: "I confirm saving despite over-allocation",
    th: "ยืนยันบันทึกแม้เกินยอด",
  },
  "invoiceCollections.payments.prepaidHint": {
    zh: "预收/未分配",
    en: "Prepaid / unallocated",
    th: "รับล่วงหน้า / คงเหลือ",
  },
  "invoiceCollections.payments.strategyManual": {
    zh: "手动",
    en: "Manual",
    th: "ด้วยตนเอง",
  },
  "invoiceCollections.status.overAllocated": {
    zh: "超额 over-allocated",
    en: "Over-allocated",
    th: "เกินยอด",
  },
  "invoiceCollections.col.allocated": {
    zh: "已冲",
    en: "Allocated",
    th: "จัดสรรแล้ว",
  },
  "invoiceCollections.col.open": {
    zh: "未清",
    en: "Open",
    th: "คงค้าง",
  },
  "invoiceCollections.col.total": {
    zh: "总额",
    en: "Total",
    th: "ยอดรวม",
  },
  "invoiceCollections.bankAccount.haideeBbl5030": {
    zh: "HAIDEE BBL 5335",
    en: "HAIDEE BBL 5335",
    th: "HAIDEE BBL 5335",
  },
  "invoiceCollections.bankAccount.hupdeeKbank5020": {
    zh: "HUPDEE KBANK 5020",
    en: "HUPDEE KBANK 5020",
    th: "HUPDEE KBANK 5020",
  },
  "invoiceCollections.bankAccount.hupdeeBbl7044": {
    zh: "HUPDEE BBL 7044",
    en: "HUPDEE BBL 7044",
    th: "HUPDEE BBL 7044",
  },
  "invoiceCollections.bankAccount.wtlPbb1725": {
    zh: "WTL PBB 1725",
    en: "WTL PBB 1725",
    th: "WTL PBB 1725",
  },
  "invoiceCollections.bankAccount.cash": {
    zh: "现金 CASH",
    en: "Cash",
    th: "เงินสด",
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
  "dataFreshness.updatedAt": {
    zh: "数据更新于 {time}",
    en: "Updated at {time}",
    th: "อัปเดตเมื่อ {time}",
  },
  "dataFreshness.newData": {
    zh: "有新数据",
    en: "New data",
    th: "มีข้อมูลใหม่",
  },
  "dataFreshness.refresh": {
    zh: "刷新",
    en: "Refresh",
    th: "รีเฟรช",
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
  "crateExport.dueTodayTitle": {
    zh: "今天待归还",
    en: "Due Today",
    th: "คืนลังวันนี้",
  },
  "crateExport.dueTodayHint": {
    zh: "泰国时间 {date} · 今日来货该还 − 今日已还 = 欠（不跨日累计）· 点击行直接归还",
    en: "Bangkok {date} · today's inbound due − returned = owed (no carry-over) · click a row to export",
    th: "เวลาไทย {date} · มาวันนี้ − คืนวันนี้ = ค้าง (ไม่ยกยอด) · คลิกแถวเพื่อคืนลัง",
  },
  "crateExport.dueTodayHistoricalHint": {
    zh: "查看 {date} 当日快照 · 该还 − 已还 = 欠（只读回顾，不可点击归还）",
    en: "Snapshot for {date} · due − returned = owed (read-only history; row click disabled)",
    th: "สรุปวันที่ {date} · ต้องคืน − คืนแล้ว = ค้าง (ดูย้อนหลังเท่านั้น คลิกแถวไม่ได้)",
  },
  "crateExport.dueTodayHistoricalEmpty": {
    zh: "该日暂无待归还记录",
    en: "No due/return activity for this date",
    th: "ไม่มีข้อมูลคืนลังในวันนี้",
  },
  "crateExport.dueDateFilterLabel": {
    zh: "查看日期",
    en: "View date",
    th: "วันที่ดู",
  },
  "crateExport.newReturnTitle": {
    zh: "新建归还",
    en: "New Return",
    th: "บันทึกคืนลังใหม่",
  },
  "crateExport.newReturnHint": {
    zh: "录入泰国车空桶归还；可从上方待还列表点选预填",
    en: "Record TH vehicle crate return; click a due row above to prefill",
    th: "บันทึกคืนลังรถไทย · คลิกแถวด้านบนเพื่อเติมข้อมูล",
  },
  "crateExport.dueTodayEmpty": {
    zh: "今天暂无待归还",
    en: "No pending returns today",
    th: "วันนี้ไม่มีลังค้างคืน",
  },
  "crateExport.dueTodayDue": {
    zh: "该还",
    en: "Due",
    th: "ต้องคืน",
  },
  "crateExport.dueTodayReturned": {
    zh: "已还",
    en: "Returned",
    th: "คืนแล้ว",
  },
  "crateExport.dueTodayOwed": {
    zh: "欠",
    en: "Owed",
    th: "ค้าง",
  },
  "crateExport.dueTodayAgentBadge": {
    zh: "代理",
    en: "Agent",
    th: "ตัวแทน",
  },
  "crateExport.dueTodayPoolBadge": {
    zh: "池",
    en: "Pool",
    th: "พูล",
  },
  "crateExport.dueTodayExpandMembers": {
    zh: "展开旗下客户",
    en: "Expand members",
    th: "ขยายลูกค้าในกลุ่ม",
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
  "crateExport.agentOwedSuggested": {
    zh: "该还总数",
    en: "Owed total",
    th: "ยอดค้างรวม",
  },
  "crateExport.agentMemberBreakdown": {
    zh: "子顾客明细",
    en: "Member breakdown",
    th: "รายละเอียดลูกค้าย่อย",
  },
  "crateExport.agentMemberBreakdownHint": {
    zh: "以下为当日来货，仅供参考；实收数量请按代理汇总填写。",
    en: "Today's inbound per member (reference only). Enter actual totals for the agent.",
    th: "รายการรับเข้าวันนี้ต่อลูกค้าย่อย (อ้างอิง) กรอกจำนวนจริงรวมของตัวแทน",
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
  "crateImport.noReturn": {
    zh: "确认无回桶",
    en: "No return",
    th: "ไม่มีลังคืน",
  },
  "crateImport.rowState.pending": {
    zh: "待录",
    en: "Pending",
    th: "รอบันทึก",
  },
  "crateImport.rowState.recorded": {
    zh: "已录",
    en: "Recorded",
    th: "บันทึกแล้ว",
  },
  "crateImport.rowState.noReturn": {
    zh: "无桶",
    en: "No crates",
    th: "ไม่มีลัง",
  },
  "crateImport.rowState.awaitingQty": {
    zh: "待司机报数 · 市场已通知司机",
    en: "Awaiting driver qty · market notified",
    th: "รอคนขับรายงานจำนวน · แจ้งตลาดแล้ว",
  },
  "crateImport.addMarketForPlate": {
    zh: "+ 同车加市场",
    en: "+ Add market (same truck)",
    th: "+ เพิ่มตลาด (รถคันเดียวกัน)",
  },
  "crateImport.saveResult": {
    zh: "已保存 {saved} 行；{skipped} 行未选市场已跳过",
    en: "Saved {saved} row(s); {skipped} row(s) skipped (no market)",
    th: "บันทึก {saved} แถว; ข้าม {skipped} แถว (ยังไม่เลือกตลาด)",
  },
  "crateImport.error.noReturnNeedsMarket": {
    zh: "确认无回桶时需选择来源市场",
    en: "Select a source market before confirming no return",
    th: "กรุณาเลือกตลาดต้นทางก่อนยืนยันว่าไม่มีลังคืน",
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
  "customerCrateStock.agent.manage": {
    zh: "管理代理",
    en: "Manage Agents",
    th: "จัดการตัวแทน",
  },
  "customerCrateStock.agent.create": {
    zh: "新建代理",
    en: "New Agent",
    th: "สร้างตัวแทน",
  },
  "customerCrateStock.agent.badge": {
    zh: "代理",
    en: "Agent",
    th: "ตัวแทน",
  },
  "customerCrateStock.agent.legacyPoolHint": {
    zh: "宋卡/北大年池：归入仅登记关系，不搬库存",
    en: "SK/PTN pool: join registers membership only; pool stock unchanged",
    th: "พูลสงขลา/ปัตตานี: เข้ากลุ่มบันทึกความสัมพันธ์เท่านั้น ไม่ย้ายสต๊อก",
  },
  "customerCrateStock.agent.membersTitle": {
    zh: "组员管理",
    en: "Members",
    th: "สมาชิก",
  },
  "customerCrateStock.agent.noMembers": {
    zh: "暂无组员",
    en: "No members yet",
    th: "ยังไม่มีสมาชิก",
  },
  "customerCrateStock.agent.subChannelBadge": {
    zh: "子渠道",
    en: "Sub-channel",
    th: "ช่องทางย่อย",
  },
  "customerCrateStock.agent.subChannelHint": {
    zh: "子顾客渠道挂靠：桶账记在代理/池总账，非正式组员",
    en: "Sub-customer channel affiliate: stock is on agent/pool total ledger, not formal membership",
    th: "ช่องทางลูกค้าย่อย: สต๊อกอยู่ในบัญชีรวมตัวแทน/พูล ไม่ใช่สมาชิกกลุ่ม",
  },
  "customerCrateStock.agent.addMember": {
    zh: "添加顾客",
    en: "Add member",
    th: "เพิ่มลูกค้า",
  },
  "customerCrateStock.agent.searchMember": {
    zh: "搜索运营顾客",
    en: "Search operational shipper",
    th: "ค้นหาผู้ส่งปฏิบัติการ",
  },
  "customerCrateStock.agent.removeMember": {
    zh: "移出",
    en: "Remove",
    th: "นำออก",
  },
  "customerCrateStock.agent.createTitle": {
    zh: "新建代理主体",
    en: "Create stock agent",
    th: "สร้างตัวแทนสต๊อก",
  },
  "customerCrateStock.agent.name": {
    zh: "名称",
    en: "Name",
    th: "ชื่อ",
  },
  "customerCrateStock.agent.code": {
    zh: "代码后缀(可选)",
    en: "Code suffix (optional)",
    th: "รหัสต่อท้าย (ไม่บังคับ)",
  },
  "customerCrateStock.agent.notes": {
    zh: "备注(可选)",
    en: "Notes (optional)",
    th: "หมายเหตุ (ไม่บังคับ)",
  },
  "customerCrateStock.agent.confirmJoinTitle": {
    zh: "确认归入",
    en: "Confirm join",
    th: "ยืนยันเข้ากลุ่ม",
  },
  "customerCrateStock.agent.confirmJoinBody": {
    zh: "将 {member} 库存并入 {agent}？并入后该顾客不再独立显示库存。",
    en: "Merge {member} stock into {agent}? This shipper will no longer show independent stock.",
    th: "รวมสต๊อก {member} เข้า {agent}? ลูกค้ารายนี้จะไม่แสดงสต๊อกแยกอีก",
  },
  "customerCrateStock.agent.confirmRemoveTitle": {
    zh: "确认移出",
    en: "Confirm remove",
    th: "ยืนยันนำออก",
  },
  "customerCrateStock.agent.confirmRemoveBody": {
    zh: "移出后 {member} 库存归零，{agent} 库存不变，需人工调整。确认？",
    en: "After removal, {member} stock will be zeroed; {agent} stock unchanged. Manual adjustment required. Confirm?",
    th: "หลังนำออก สต๊อก {member} จะเป็นศูนย์ สต๊อก {agent} ไม่เปลี่ยน ต้องปรับด้วยตนเอง ยืนยัน?",
  },
  "customerCrateStock.agent.memberAssigned": {
    zh: "已归 {agent}",
    en: "Under {agent}",
    th: "อยู่ภายใต้ {agent}",
  },
  "multiOrigin.badge": {
    zh: "多产地",
    en: "Multi-origin",
    th: "หลายแหล่ง",
  },
  "multiOrigin.configTitle": {
    zh: "多产地客户配置",
    en: "Multi-origin customer config",
    th: "ตั้งค่าลูกค้าหลายแหล่ง",
  },
  "multiOrigin.isMultiOrigin": {
    zh: "标记为多产地客户",
    en: "Mark as multi-origin customer",
    th: "ทำเครื่องหมายลูกค้าหลายแหล่ง",
  },
  "multiOrigin.standardLocations": {
    zh: "标准产地清单",
    en: "Standard origin list",
    th: "รายการแหล่งมาตรฐาน",
  },
  "multiOrigin.noLocations": {
    zh: "尚未添加产地，请至少添加一个",
    en: "No origins yet — add at least one",
    th: "ยังไม่มีแหล่ง — เพิ่มอย่างน้อยหนึ่งรายการ",
  },
  "multiOrigin.locationPlaceholder": {
    zh: "如 KRABI、N&K",
    en: "e.g. KRABI, N&K",
    th: "เช่น KRABI, N&K",
  },
  "multiOrigin.addLocalHint": {
    zh: "「+」仅加入清单，需点「保存」才写入数据库",
    en: "+ adds to the list locally; click Save to persist",
    th: "กด + เพิ่มในรายการเท่านั้น ต้องกดบันทึกจึงจะเขียนลงฐานข้อมูล",
  },
  "multiOrigin.standardOrigin": {
    zh: "标准产地",
    en: "Standard origin",
    th: "แหล่งมาตรฐาน",
  },
  "multiOrigin.selectOrigin": {
    zh: "请选择产地",
    en: "Select origin",
    th: "เลือกแหล่ง",
  },
  "multiOrigin.error.required": {
    zh: "请选择标准产地",
    en: "Please select a standard origin",
    th: "กรุณาเลือกแหล่งมาตรฐาน",
  },
  "multiOrigin.error.duplicate": {
    zh: "该产地已在清单中",
    en: "Origin already in list",
    th: "แหล่งนี้มีในรายการแล้ว",
  },
  "driverExpenses.page.title": {
    zh: "司机费用",
    en: "Driver Expenses",
    th: "ค่าใช้จ่ายคนขับ",
  },
  "driverExpenses.page.subtitle": {
    zh: "下货费 · 上桶费 · 司机报销单",
    en: "Unloading fees · Loading fees · Driver vouchers",
    th: "ค่าขนถ่าย · ค่าขึ้นลัง · ใบเบิกคนขับ",
  },
  "driverExpenses.module.voucher": {
    zh: "Module 2 — 司机报销单",
    en: "Module 2 — Driver Voucher",
    th: "โมดูล 2 — ใบเบิกคนขับ",
  },
  "driverExpenses.module.unloading": {
    zh: "Module 1 — 下货费",
    en: "Module 1 — Unloading Fees",
    th: "โมดูล 1 — ค่าขนถ่าย",
  },
  "driverExpenses.zone.today": {
    zh: "当日派车趟次",
    en: "Today's dispatch trips",
    th: "เที่ยวรถวันนี้",
  },
  "driverExpenses.zone.todo": {
    zh: "待办",
    en: "To-do",
    th: "รายการค้าง",
  },
  "driverExpenses.zone.history": {
    zh: "历史",
    en: "History",
    th: "ประวัติ",
  },
  "driverExpenses.col.date": {
    zh: "日期",
    en: "Date",
    th: "วันที่",
  },
  "driverExpenses.col.plate": {
    zh: "车牌",
    en: "Plate",
    th: "ทะเบียน",
  },
  "driverExpenses.col.driver": {
    zh: "司机",
    en: "Driver",
    th: "คนขับ",
  },
  "driverExpenses.col.route": {
    zh: "市场",
    en: "Route",
    th: "เส้นทาง",
  },
  "driverExpenses.col.referenceNo": {
    zh: "DO / 单号",
    en: "DO / Voucher",
    th: "DO / เลขใบเบิก",
  },
  "driverExpenses.col.unsettledDays": {
    zh: "未结天数",
    en: "Unsettled",
    th: "ค้างชำระ",
  },
  "driverExpenses.todo.unsettledDays": {
    zh: "已 {days} 天未结",
    en: "{days} day(s) unsettled",
    th: "ค้าง {days} วัน",
  },
  "driverExpenses.col.voucherNo": {
    zh: "单号",
    en: "Voucher No",
    th: "เลขที่ใบเบิก",
  },
  "driverExpenses.col.expense": {
    zh: "支出",
    en: "Expense",
    th: "ค่าใช้จ่าย",
  },
  "driverExpenses.search": {
    zh: "查询",
    en: "Search",
    th: "ค้นหา",
  },
  "driverExpenses.syncEstimates": {
    zh: "重新同步估算",
    en: "Re-sync estimates",
    th: "ซิงก์ประมาณการใหม่",
  },
  "driverExpenses.from": {
    zh: "从",
    en: "From",
    th: "ตั้งแต่",
  },
  "driverExpenses.to": {
    zh: "至",
    en: "To",
    th: "ถึง",
  },
  "driverExpenses.searchPlaceholder": {
    zh: "单号 / 车牌",
    en: "Voucher no / plate",
    th: "เลขใบเบิก / ทะเบียน",
  },
  "driverExpenses.pendingReviewCount": {
    zh: "待审核 ({count})",
    en: "Pending review ({count})",
    th: "รอตรวจ ({count})",
  },
  "driverExpenses.status.all": {
    zh: "全部状态",
    en: "All statuses",
    th: "ทุกสถานะ",
  },
  "driverExpenses.status.draft": {
    zh: "估算",
    en: "Draft",
    th: "ประมาณการ",
  },
  "driverExpenses.status.clerk_entered": {
    zh: "待确认",
    en: "Pending confirm",
    th: "รอยืนยัน",
  },
  "driverExpenses.status.confirmed": {
    zh: "已确认",
    en: "Confirmed",
    th: "ยืนยันแล้ว",
  },
  "driverExpenses.status.pending_review": {
    zh: "待审核",
    en: "Pending review",
    th: "รอตรวจ",
  },
  "driverExpenses.status.approved": {
    zh: "已审",
    en: "Approved",
    th: "อนุมัติแล้ว",
  },
  "driverExpenses.status.rejected": {
    zh: "已打回",
    en: "Rejected",
    th: "ตีกลับ",
  },
  "driverExpenses.status.notEntered": {
    zh: "未录入",
    en: "Not entered",
    th: "ยังไม่บันทึก",
  },
  "driverExpenses.action.enter": {
    zh: "录入",
    en: "Enter",
    th: "บันทึก",
  },
  "driverExpenses.action.continue": {
    zh: "继续录入",
    en: "Continue",
    th: "บันทึกต่อ",
  },
  "driverExpenses.action.view": {
    zh: "查看",
    en: "View",
    th: "ดู",
  },
  "driverExpenses.action.review": {
    zh: "审核",
    en: "Review",
    th: "ตรวจ",
  },
  "driverExpenses.empty.queryFirst": {
    zh: "请选择日期后点击「查询」加载当日趟次",
    en: "Select a date and click Search to load today's trips",
    th: "เลือกวันที่แล้วกดค้นหาเพื่อโหลดเที่ยววันนี้",
  },
  "driverExpenses.empty.noDispatch": {
    zh: "此日期无派车趟次",
    en: "No dispatch trips on this date",
    th: "ไม่มีเที่ยวรถในวันนี้",
  },
  "driverExpenses.empty.noTodo": {
    zh: "暂无待办（未录入趟次或待处理费用单）",
    en: "No to-do items (unentered trips or pending vouchers)",
    th: "ไม่มีรายการค้าง (เที่ยวยังไม่บันทึกหรือใบเบิกรอดำเนินการ)",
  },
  "driverExpenses.empty.historyQuery": {
    zh: "请点击「查询」加载历史列表",
    en: "Click Search to load history",
    th: "กดค้นหาเพื่อโหลดประวัติ",
  },
  "driverExpenses.empty.noHistory": {
    zh: "暂无符合条件的报销单",
    en: "No vouchers match your filters",
    th: "ไม่พบใบเบิกตามเงื่อนไข",
  },
  "driverExpenses.loading": {
    zh: "加载中…",
    en: "Loading…",
    th: "กำลังโหลด…",
  },
  "driverExpenses.loadFailed": {
    zh: "加载失败",
    en: "Failed to load",
    th: "โหลดไม่สำเร็จ",
  },
  "driverExpenses.syncFailed": {
    zh: "同步失败",
    en: "Sync failed",
    th: "ซิงก์ไม่สำเร็จ",
  },
  "driverExpenses.saveFailed": {
    zh: "保存失败",
    en: "Save failed",
    th: "บันทึกไม่สำเร็จ",
  },
  "driverExpenses.form.saveConfirm": {
    zh: "保存并确认",
    en: "Save & confirm",
    th: "บันทึกและยืนยัน",
  },
  "driverExpenses.form.saveFlag": {
    zh: "保存并标记需审核",
    en: "Save & flag for review",
    th: "บันทึกและส่งตรวจ",
  },
  "driverExpenses.form.flagNote": {
    zh: "标记需审核原因",
    en: "Reason for review",
    th: "เหตุผลที่ส่งตรวจ",
  },
  "driverExpenses.form.flagNoteRequired": {
    zh: "请填写标记需审核的原因",
    en: "Clerk note is required when flagging for review",
    th: "กรุณาระบุเหตุผลที่ส่งตรวจ",
  },
  "driverExpenses.form.flagNotePlaceholder": {
    zh: "说明为何需要审核…",
    en: "Explain why review is needed…",
    th: "อธิบายเหตุผลที่ต้องตรวจ…",
  },
  "driverExpenses.form.submitFlag": {
    zh: "提交标记",
    en: "Submit flag",
    th: "ส่งตรวจ",
  },
  "driverExpenses.form.rejectionBanner": {
    zh: "ADMIN 打回原因",
    en: "Rejection reason",
    th: "เหตุผลที่ตีกลับ",
  },
  "driverExpenses.form.transitionFailed": {
    zh: "状态变更失败，请重试确认或标记",
    en: "Status change failed — retry confirm or flag",
    th: "เปลี่ยนสถานะไม่สำเร็จ — ลองยืนยันหรือส่งตรวจอีกครั้ง",
  },
  "driverExpenses.form.reopen": {
    zh: "重新打开 Reopen",
    en: "Reopen",
    th: "เปิดใหม่ Reopen",
  },
  "driverExpenses.form.reopenHint": {
    zh: "重新打开将清除已生效的实际成本值，需重新确认或审批后才会再次写入 P&L。",
    en: "Reopening clears applied actual costs; confirm or approve again to write them back to P&L.",
    th: "การเปิดใหม่จะล้างค่าจริงที่บันทึกแล้ว ต้องยืนยันหรืออนุมัติใหม่จึงจะเขียนกลับ P&L",
  },
  "driverExpenses.form.reopenConfirm": {
    zh: "确定重新打开此报销单？已生效的实际值将被清除，需重新确认或审批。",
    en: "Reopen this voucher? Applied actual values will be cleared and must be confirmed or approved again.",
    th: "เปิดใบเบิกนี้ใหม่? ค่าจริงที่บันทึกแล้วจะถูกล้างและต้องยืนยันหรืออนุมัติใหม่",
  },
  "driverExpenses.form.reopenFailed": {
    zh: "重新打开失败",
    en: "Reopen failed",
    th: "เปิดใหม่ไม่สำเร็จ",
  },
  "driverExpenses.unloading.queryHint": {
    zh: "查询当日数据后可查看下货费摘要",
    en: "Search today's data to view unloading fee summary",
    th: "ค้นหาข้อมูลวันนี้เพื่อดูสรุปค่าขนถ่าย",
  },
  "driverExpenses.unloading.empty": {
    zh: "此日期暂无下货费记录（派车保存后会自动生成估算）",
    en: "No unloading fees for this date (estimates appear after dispatch is saved)",
    th: "ไม่มีค่าขนถ่ายวันนี้ (ประมาณการจะสร้างหลังบันทึกจัดรถ)",
  },
  "driverExpenses.unloading.expand": {
    zh: "展开下货费明细",
    en: "Show unloading fee details",
    th: "แสดงรายละเอียดค่าขนถ่าย",
  },
  "driverExpenses.unloading.collapse": {
    zh: "收起",
    en: "Collapse",
    th: "ย่อ",
  },
  "driverExpenses.unloading.total": {
    zh: "合计",
    en: "Total",
    th: "รวม",
  },
  "driverExpenses.unloading.voucherReadonly": {
    zh: "此趟已有报销单，下货费/KPB 请在报销单按市场录入实际值（此处只读）",
    en: "This trip has a voucher — enter per-market unload/KPB actuals on the voucher (read-only here)",
    th: "ทริปนี้มีใบเบิกแล้ว — กรอกค่าขนถ่าย/KPB ต่อตลาดในใบเบิก (อ่านอย่างเดียวที่นี่)",
  },
  "driverExpenses.fee.kpbParkingIpoh": {
    zh: "停车费",
    en: "Parking",
    th: "ค่าจอดรถ",
  },
  "driverExpenses.unloading.kpbParkingIpohNote": {
    zh: "即停车费",
    en: "Parking fee",
    th: "ค่าจอดรถ",
  },
  "driverExpenses.unloading.kpbParkingFieldSmall": {
    zh: "停车费·小",
    en: "Parking·S",
    th: "จอด·เล็ก",
  },
  "driverExpenses.unloading.kpbParkingFieldLarge": {
    zh: "停车费·大",
    en: "Parking·L",
    th: "จอด·ใหญ่",
  },
  "driverExpenses.unloading.kpbParkingFieldBox": {
    zh: "停车费·箱",
    en: "Parking·Box",
    th: "จอด·กล่อง",
  },
  "driverExpenses.unloading.kpbPermanentlyCancelled": {
    zh: "已永久取消",
    en: "Permanently cancelled",
    th: "ยกเลิกถาวร",
  },
  "driverExpenses.unloading.unloadUnusedFieldNote": {
    zh: "此市场桶统一一个价，本格不参与计算",
    en: "Single barrel rate for this market; this cell is not used in calculation",
    th: "ตลาดนี้ใช้ราคาถังเดียว ช่องนี้ไม่นำไปคำนวณ",
  },
  "driverExpenses.unloading.jbExempt": {
    zh: "免收",
    en: "Exempt",
    th: "ยกเว้น",
  },
  "driverExpenses.unloading.klSubMarketNote": {
    zh: "BP / MP 共用此行费率；SL 下货同 KL，但 SL 的 KPB 不收（豁免）",
    en: "BP / MP share this row; SL unload uses KL rates but SL KPB is waived",
    th: "BP / MP ใช้แถวนี้ SL ขนถ่ายตาม KL แต่ไม่เก็บ KPB",
  },
  "driverExpenses.unloading.bmPindahDisplayPendingNote": {
    zh: "实际按趟 12/20，设置页整理中",
    en: "Actual per-trip 12/20; settings UI update pending",
    th: "จริงต่อเที่ยว 12/20 กำลังปรับหน้าตั้งค่า",
  },
  "driverExpenses.unloading.bmPindahSectionTitle": {
    zh: "BM Pindah（TP / KT / P / SA / NT）",
    en: "BM Pindah (TP / KT / P / SA / NT)",
    th: "BM Pindah (TP / KT / P / SA / NT)",
  },
  "driverExpenses.unloading.bmPindahPerTripNote": {
    zh: "按趟一次计费，不按桶；五市场共用此费率",
    en: "Charged once per trip by truck size; shared by all five markets",
    th: "คิดครั้งเดียวต่อเที่ยวตามขนาดรถ ใช้ร่วมทั้งห้าตลาด",
  },
  "driverExpenses.unloading.colPerTripSmallTruck": {
    zh: "小车趟费",
    en: "Small truck / trip",
    th: "รถเล็ก/เที่ยว",
  },
  "driverExpenses.unloading.colPerTripLargeTruck": {
    zh: "大车趟费",
    en: "Large truck / trip",
    th: "รถใหญ่/เที่ยว",
  },
  "driverExpenses.unloading.mcSelfUnloadSection": {
    zh: "自送下货",
    en: "Self delivery unload",
    th: "ขนถ่ายส่งเอง",
  },
  "driverExpenses.unloading.mcThirdPartyFlat": {
    zh: "第三方一口价",
    en: "Third-party flat rate",
    th: "เหมาจ่ายบุคคลที่สาม",
  },
  "driverExpenses.unloading.mcThirdPartyNote": {
    zh: "仅 mc_delivery_mode=third_party 适用，不收 KPB",
    en: "Applies only when mc_delivery_mode=third_party; no KPB",
    th: "ใช้เมื่อ mc_delivery_mode=third_party เท่านั้น ไม่เก็บ KPB",
  },
  "driverExpenses.unloading.deprecatedCrateCols": {
    zh: "已废弃",
    en: "Deprecated",
    th: "เลิกใช้",
  },
  "driverExpenses.unloading.colSmall": {
    zh: "小桶",
    en: "Small",
    th: "ถังเล็ก",
  },
  "driverExpenses.unloading.colLarge": {
    zh: "大桶",
    en: "Large",
    th: "ถังใหญ่",
  },
  "driverExpenses.unloading.colBox": {
    zh: "箱",
    en: "Box",
    th: "กล่อง",
  },
  "driverExpenses.unloading.colKpbSmall": {
    zh: "KPB小",
    en: "KPB S",
    th: "KPB เล็ก",
  },
  "driverExpenses.unloading.colKpbLarge": {
    zh: "KPB大",
    en: "KPB L",
    th: "KPB ใหญ่",
  },
  "driverExpenses.unloading.colKpbBox": {
    zh: "KPB箱",
    en: "KPB Box",
    th: "KPB กล่อง",
  },
  "driverExpenses.unloading.save": {
    zh: "保存",
    en: "Save",
    th: "บันทึก",
  },
  "driverExpenses.unloading.marketCol": {
    zh: "市场",
    en: "Market",
    th: "ตลาด",
  },
  "operations.payrollWarning.title": {
    zh: "薪资警告",
    en: "Payroll Warnings",
    th: "คำเตือนค่าแรง",
  },
  "operations.payrollWarning.p1": {
    zh: "薪资警告：{count} 趟有效派车/包车缺少工资行",
    en: "Payroll warning: {count} active trip(s) missing payroll row",
    th: "คำเตือนค่าแรง: {count} เที่ยวที่ไม่มีแถว payroll",
  },
  "operations.payrollWarning.p2": {
    zh: "{count} 趟趟次津贴应为 {sum} 实为 0",
    en: "{count} trip(s) trip allowance should be {sum} but is 0",
    th: "{count} เที่ยวค่าเที่ยวควร {sum} แต่เป็น 0",
  },
  "operations.payrollWarning.p3": {
    zh: "{count} 趟回桶提成缺失（共 {qty} 桶）",
    en: "{count} trip(s) missing crate-return commission ({qty} crates)",
    th: "{count} เที่ยวขาดค่าคอมมิชชั่นคืนถัง ({qty} ถัง)",
  },
  "operations.payrollWarning.p4": {
    zh: "{count} 单包车固定工钱未同步进工资",
    en: "{count} charter(s) fixed driver salary not synced to payroll",
    th: "{count} รายการเหมารถยังไม่ sync ค่าแรงคนขับ",
  },
  "operations.payrollWarning.p5": {
    zh: "{count} 单包车回桶提成缺失",
    en: "{count} charter(s) missing crate-return commission",
    th: "{count} รายการเหมารถขาดค่าคอมมิชชั่นคืนถัง",
  },
  "operations.payrollWarning.d5": {
    zh: "{count} 行付款模式/币种/开票主体未设置",
    en: "{count} line(s) missing payment mode / currency / billing company",
    th: "{count} แถวยังไม่ตั้ง payment mode / สกุลเงิน / billing company",
  },
  "operations.payrollWarning.unsyncedToggle": {
    zh: "可能待同步 {count} 条",
    en: "Possibly pending sync ({count})",
    th: "อาจรอ sync ({count})",
  },
  "operations.payrollWarning.unsyncedHint": {
    zh: "近 2 天内派车或 24 小时内新建的单据，sync 可能尚未完成，不计入主警告。",
    en: "Trips within 2 days or created in the last 24h may still be syncing; excluded from main counts.",
    th: "เที่ยวภายใน 2 วันหรือสร้างภายใน 24 ชม. อาจยัง sync ไม่เสร็จ ไม่นับในคำเตือนหลัก",
  },
  "operations.payrollWarning.samples": {
    zh: "示例",
    en: "Samples",
    th: "ตัวอย่าง",
  },
  "operations.payrollWarning.dataQuality": {
    zh: "数据完整性",
    en: "Data completeness",
    th: "ความครบถ้วนของข้อมูล",
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
