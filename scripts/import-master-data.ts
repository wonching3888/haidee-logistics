import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type UpsertStats = { inserted: number; updated: number; skipped: number };

const DRIVER_ROWS = [
  { nickname: "Halim", full_name: "Abdul Halim Bin Ahmad", ic_number: "920423-02-5747", bank_name: "CIMB", bank_account: "705-806-8978", epf_number: "18874734", socso_number: "920423025747", tin_number: "IG24766536030", children_count: 2, phone: "0195056826", marital_status: "married" },
  { nickname: "Awang", full_name: "Sharif Bin Mat", ic_number: "731127-02-5993", bank_name: "HLBB", bank_account: "0315-1216-472", epf_number: "12805588", socso_number: "731127025993", tin_number: "IG53883187010", children_count: 2, phone: "01115274050", marital_status: "married" },
  { nickname: "Azrin", full_name: "Mohd Azrin Bin Mohd Sadri", ic_number: "870708-02-5529", bank_name: "Maybank", bank_account: "1520-9572-6872", epf_number: "17091372", socso_number: "870708025529", tin_number: "IG55274074080", children_count: 4, phone: "0133751430", marital_status: "married" },
  { nickname: "Wan", full_name: "Mustafa", ic_number: "870331-29-5157", bank_name: "Maybank", bank_account: "1051-3013-1330", epf_number: "16977592", socso_number: "870331295157", tin_number: "IG40431418100", children_count: 4, phone: "0183676235", marital_status: "married" },
  { nickname: "Own", full_name: "Muhammad Asrul Bin Abdul Jalil", ic_number: "780528-02-5653", bank_name: "PBB", bank_account: "780528025653", epf_number: "13886068", socso_number: "780528025653", tin_number: "IG25122467080", children_count: 1, phone: "01135315653", marital_status: "married" },
  { nickname: "Rozaime", full_name: "Rozaime Bin Othman", ic_number: "930703-09-5095", bank_name: "Maybank", bank_account: "1590-1304-6787", epf_number: "19379569", socso_number: "930703095095", tin_number: "IG57295761000", children_count: 4, phone: "01123460878", marital_status: "married" },
  { nickname: "Fook", full_name: "Yong Ah Fook", ic_number: "640421-02-5309", bank_name: "Maybank", bank_account: "1522-1905-8650", epf_number: "12798115", socso_number: "640421025309", tin_number: "IG5425518100", children_count: 0, phone: "0173461171", marital_status: "single" },
  { nickname: "Faizal", full_name: "Ku Mohd Faizal Bin Ku Aziz", ic_number: "810824-02-5791", bank_name: "Maybank", bank_account: "1520-6882-8445", epf_number: "15091618", socso_number: "810824025791", tin_number: "IG22158103000", children_count: 3, phone: "0194755791", marital_status: "married" },
  { nickname: "Akim", full_name: "Muhammad Hakim Bin Mat Sarip", ic_number: "971108-02-5333", bank_name: "PBB", bank_account: "692-986-8521", epf_number: "22977010", socso_number: "971108025333", tin_number: "IG29508534070", children_count: 2, phone: "0194932482", marital_status: "married" },
  { nickname: "Naim", full_name: "Mohamad Naim Bin Zulkefli", ic_number: "980618-09-5053", bank_name: "Maybank", bank_account: "5590-1234-8321", epf_number: "22655742", socso_number: "980618095053", tin_number: "IG29052842090", children_count: 0, phone: "0183124379", marital_status: "single" },
  { nickname: "Azhar", full_name: "Norazhar Bin Baharom", ic_number: "810927-09-5047", bank_name: "CIMB", bank_account: "860-333-8501", epf_number: "17149154", socso_number: "810927095047", tin_number: "IG11679262000", children_count: 3, phone: "01157340874", marital_status: "married" },
  { nickname: "Pinat", full_name: "Mohd Shafinar Bin Abdullah", ic_number: "850527-02-5089", bank_name: "PBB", bank_account: "681-324-2001", epf_number: "19046951", socso_number: "850527025089", tin_number: "IG54845144030", children_count: 3, phone: "0194957530", marital_status: "married" },
  { nickname: "Din", full_name: "Khairuddin Bin Hashim", ic_number: "890518-02-5745", bank_name: "Maybank", bank_account: "1522-1911-0535", epf_number: "17697105", socso_number: "890518025745", tin_number: "IG26679143030", children_count: 0, phone: "0132865539", marital_status: "single" },
  { nickname: "Ikmal", full_name: "Mohd Ikmal Hisham Bin Hanapi", ic_number: "890628-02-5885", bank_name: "PBB", bank_account: "686-873-0423", epf_number: "17814248", socso_number: "890628025885", tin_number: "IG25668552050", children_count: 2, phone: "0103872159", marital_status: "married" },
] as const;

function mapBankName(value: string) {
  const trimmed = value.trim();
  if (trimmed.toUpperCase() === "K") return "Maybank";
  return trimmed;
}

const SHIPPER_ROWS = [
  { autocount_code: "3000-B001", name: "BS EASTERN FISHERY SDN BHD", currency: "MYR", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3000-B002", name: "BEST BROTHER FISHERY SDN BHD", currency: "MYR", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3002-F002", name: "FISHCO RESOURCES SDN BHD", currency: "MYR", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3002-G002", name: "GLORIA MARINE SDN BHD", currency: "MYR", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3002-L002", name: "LEE LEE FISHERY", currency: "MYR", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3002-L004", name: "LIONG HAN FISHERY SDN BHD", currency: "MYR", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3002-M002", name: "MENG RANONG", currency: "MYR", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3002-S006", name: "SAKDA PATTANI", currency: "MYR", payment_by: "SHIPPER", own_crate: true, return_rate: 4.5 },
  { autocount_code: "3002-X001", name: "XIN HERN", currency: "MYR", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3002-Y004", name: "YU LE FISH ENTERPRISE", currency: "MYR", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-001", name: "HOE - SONGKHLA", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-002", name: "J.P FISHERY", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-003", name: "JIAB", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-004", name: "JIT RANONG", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-005", name: "KIM 9", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-006", name: "KO CHEEP", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-007", name: "LITA", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-008", name: "SOPHON", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-009", name: "TANAPORN", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-010", name: "TATA", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-011", name: "TN", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-C002", name: "CHUN MENG", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-P007", name: "PT PHUKET - KO CHAI", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-S001", name: "SENG HUAT - TAKOR", currency: "MYR", payment_by: "CONSIGNEE", own_crate: false },
  { autocount_code: "3001-A001", name: "ARSAN FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A002", name: "AIK HUAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A003", name: "ANN - RANONG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A004", name: "AR MEI - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A005", name: "ARUN - PHUKET", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A006", name: "AR MEI - RANONG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A007", name: "ANN - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A008", name: "ANYA SEAFOOD", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-A009", name: "AH HENG FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-A010", name: "AR MUI - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-B001", name: "BROTHER - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-B002", name: "BAN HENG TRADING CO LTD", currency: "THB", payment_by: "SHIPPER", own_crate: true, return_rate: 12 },
  { autocount_code: "3001-C001", name: "CHALEE FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false, return_rate: 15 },
  { autocount_code: "3001-C002", name: "CHUN MENG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C003", name: "CH FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C004", name: "CT - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C005", name: "CT - SONGKHLA", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C006", name: "C P", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C007", name: "CHAH", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-C008", name: "CH FISHERY - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-D001", name: "DING SENG - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-D002", name: "DOLPHIN", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-G001", name: "GONG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-G002", name: "GUAN - HATYAI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H001", name: "HONG LEE", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H002", name: "HAI SENG HUAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H003", name: "HENG - PHUKET(J & H)", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H004", name: "HENG DEE", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H005", name: "HUP HUAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H006", name: "HONG MENG FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H007", name: "HUAT SYARIKAT (LIM PTN)", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H008", name: "HENG HUAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-H010", name: "HENG RUNG SAENG CO LTD", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-K001", name: "KWAN - PHUKET", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-K002", name: "KH - RANONG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-K003", name: "KHOON WENG TRANSPORT LTD PART", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-L001", name: "L.A.FISHERY - PHUKET", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-M001", name: "MEENA", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N001", name: "NAI LEAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N002", name: "NAM SENG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N003", name: "NAI MENG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N004", name: "NY - RANONG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N005", name: "NR FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-N006", name: "NAZAE - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P001", name: "PPR - PHUKET", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-P002", name: "PRANACHAI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P003", name: "PNN", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P004", name: "POR RATTANI - JIAB", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P005", name: "PIN SEA PRODUCT - LAI HUAT", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P006", name: "PRIM", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P007", name: "PT PHUKET - KO CHAI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-P008", name: "PPR - SONGKHLA", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-R001", name: "RB - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S001", name: "SENG HUAT - TAKOR", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S002", name: "SOON - SONGKHLA", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S003", name: "SAHASIN - HY", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-S004", name: "SOON HENG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S005", name: "SAI - RANONG (L.A.MENG)", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S006", name: "SOH - SK", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S007", name: "SOMPONG - SK", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-S008", name: "SAHASIN - SK", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-T001", name: "THAI LAI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-T002", name: "TAT KHENG", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-T003", name: "THAI TONG FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: true },
  { autocount_code: "3001-T004", name: "TUI - PATTANI", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-V001", name: "VP FISHERY", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-W001", name: "WAN - SONGKHLA", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-Y001", name: "YIN - SONGKHLA", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-Y002", name: "Y S", currency: "THB", payment_by: "SHIPPER", own_crate: false },
  { autocount_code: "3001-Y003", name: "YUNG SU", currency: "THB", payment_by: "SHIPPER", own_crate: false },
] as const;

const CONSIGNEE_ROWS = [
  { autocount_code: "3002-H002", name: "KL G54 - HUP HONG", billing_company: "HAIDEE" },
  { autocount_code: "3002-L006", name: "KL B53 - YAHOR TRADING", billing_company: "HAIDEE" },
  { autocount_code: "3002-L005", name: "KL G36 - LIAN HAU FROZEN FOODS SDN BHD", billing_company: "HAIDEE" },
  { autocount_code: "3002-L001", name: "KL F56 - LIAN HAU FISHERY", billing_company: "HAIDEE" },
  { autocount_code: "3000-P001", name: "MC MC65 - PERUSAHAAN PAKATAN PERIKANAN SDN BHD", billing_company: "WTL" },
  { autocount_code: "3002-S003", name: "KL A53 - SPEED FISHERY", billing_company: "HAIDEE" },
  { autocount_code: "3002-L004", name: "KL B39 - LIONG HAN FISHERY SDN BHD", billing_company: "HAIDEE" },
  { autocount_code: "3002-N001", name: "KL D46 - NEW HUP HIN", billing_company: "HAIDEE" },
  { autocount_code: "3002-R001", name: "KL F49 - REMAJA", billing_company: "HAIDEE" },
  { autocount_code: "3002-S001", name: "A A43 - SIN YEE HUAT", billing_company: "HAIDEE" },
  { autocount_code: "3002-H001", name: "BM BM45 - HAK SENG", billing_company: "HAIDEE" },
  { autocount_code: "3002-C001", name: "KL A48 - CHIN HENG", billing_company: "HAIDEE" },
  { autocount_code: "3002-W001", name: "KL C42 - WONG KOK CHENG", billing_company: "HAIDEE" },
  { autocount_code: "3002-J001", name: "KL C44 - JOO GUAN", billing_company: "HAIDEE" },
  { autocount_code: "3002-A001", name: "KL C55 - AHMAD SHAHAZMI", billing_company: "HAIDEE" },
  { autocount_code: "3002-H003", name: "KL E36 - HAI HUAT", billing_company: "HAIDEE" },
  { autocount_code: "3002-F001", name: "KL E38 - FAJAR DIKARI SDN BHD", billing_company: "HAIDEE" },
  { autocount_code: "3002-N002", name: "KL F40 - WEI SHENG SEAFOOD MERCHANT (M) SDN BHD", billing_company: "HAIDEE" },
  { autocount_code: "3000-N001", name: "NT NKL - NKL FRESH MART TRADING", billing_company: "WTL" },
  { autocount_code: "3002-F003", name: "KL A56 - FRESH VILLAGE TRADING", billing_company: "HAIDEE" },
  { autocount_code: "3002-M001", name: "A A56 - M JASMI ENTERPRISE", billing_company: "HAIDEE" },
  { autocount_code: "3002-S004", name: "A B51 - SENG FISHERY", billing_company: "HAIDEE" },
] as const;

function mapPaymentParty(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "shipper") return "shipper";
  if (normalized === "consignee") return "consignee";
  return normalized;
}

function mapBillingCompany(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "haidee") return "haidee";
  if (normalized === "wtl") return "wtl";
  return normalized;
}

async function printTableColumns(table: string) {
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'
     ORDER BY ordinal_position`
  );
  console.log(
    `${table}: ${cols.map((c) => c.column_name).join(", ")}`
  );
}

async function upsertDrivers(): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };

  for (const row of DRIVER_ROWS) {
    const data = {
      name: row.nickname,
      nickname: row.nickname,
      fullName: row.full_name,
      icNumber: row.ic_number,
      bankName: mapBankName(row.bank_name),
      bankAccount: row.bank_account,
      epfNumber: row.epf_number,
      socsoNumber: row.socso_number,
      maritalStatus: row.marital_status,
      childCount: row.children_count,
      active: true,
    };

    const existing = await prisma.driver.findUnique({
      where: { icNumber: row.ic_number },
    });

    if (existing) {
      await prisma.driver.update({
        where: { id: existing.id },
        data,
      });
      stats.updated += 1;
      continue;
    }

    await prisma.driver.create({ data });
    stats.inserted += 1;
  }

  return stats;
}

async function upsertShippers(defaultTongTypeId: string): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
  const seen = new Map<string, number>();

  for (let index = 0; index < SHIPPER_ROWS.length; index += 1) {
    const row = SHIPPER_ROWS[index];
    const prev = seen.get(row.autocount_code);
    if (prev != null) {
      console.warn(
        `  duplicate shipper code ${row.autocount_code} (row ${prev + 1} overwritten by row ${index + 1})`
      );
    }
    seen.set(row.autocount_code, index);

    const data = {
      code: row.autocount_code,
      name: row.name,
      currency: row.currency,
      paymentParty: mapPaymentParty(row.payment_by),
      company: "haidee",
      pickupLocation: "SADAO",
      active: true,
    };

    const existing = await prisma.shipper.findUnique({
      where: { code: row.autocount_code },
    });

    if (existing) {
      await prisma.shipper.update({
        where: { id: existing.id },
        data,
      });
      stats.updated += 1;
      continue;
    }

    await prisma.shipper.create({
      data: {
        ...data,
        defaultTongTypeId,
      },
    });
    stats.inserted += 1;
  }

  return stats;
}

async function upsertConsignees(): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };

  for (const row of CONSIGNEE_ROWS) {
    const data = {
      code: row.autocount_code,
      name: row.name,
      billingCompany: mapBillingCompany(row.billing_company),
      active: true,
    };

    const existing = await prisma.consignee.findUnique({
      where: { code: row.autocount_code },
    });

    if (existing) {
      await prisma.consignee.update({
        where: { id: existing.id },
        data,
      });
      stats.updated += 1;
      continue;
    }

    await prisma.consignee.create({ data });
    stats.inserted += 1;
  }

  return stats;
}

async function main() {
  console.log("=== Table columns ===");
  await printTableColumns("drivers");
  await printTableColumns("shippers");
  await printTableColumns("consignees");

  console.log("\n=== Field mapping notes ===");
  console.log(
    "drivers: nickname→nickname+name, full_name→full_name, ic_number→ic_number (unique), bank_name, bank_account"
  );
  console.log(
    "drivers skipped (no DB column): tin_number, phone"
  );
  console.log(
    "shippers: autocount_code→code, payment_by→payment_party, currency→currency"
  );
  console.log(
    "shippers skipped (no DB column): own_crate, return_rate"
  );
  console.log(
    "consignees: autocount_code→code, billing_company→billing_company (lowercase)"
  );

  const abb = await prisma.tongType.findUnique({ where: { code: "ABB" } });
  if (!abb) {
    throw new Error("ABB tong type not found — run prisma db seed first");
  }

  const driverStats = await upsertDrivers();
  const shipperStats = await upsertShippers(abb.id);
  const consigneeStats = await upsertConsignees();

  console.log("\n=== Upsert results ===");
  console.log(
    `drivers: inserted=${driverStats.inserted}, updated=${driverStats.updated}, skipped=${driverStats.skipped}`
  );
  console.log(
    `shippers: inserted=${shipperStats.inserted}, updated=${shipperStats.updated}, skipped=${shipperStats.skipped}`
  );
  console.log(
    `consignees: inserted=${consigneeStats.inserted}, updated=${consigneeStats.updated}, skipped=${consigneeStats.skipped}`
  );

  console.log("\n=== Totals in database ===");
  console.log(
    JSON.stringify(
      {
        drivers: await prisma.driver.count(),
        shippers: await prisma.shipper.count(),
        consignees: await prisma.consignee.count(),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
