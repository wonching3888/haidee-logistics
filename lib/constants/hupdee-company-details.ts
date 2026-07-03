/** HUP DEE TRANSPORT — mode 1a tax invoice issuer (selected shippers only). */
export const HUPDEE_INVOICE_COMPANY_HEADER = {
  nameZh: "",
  nameEn: "HUP DEE TRANSPORT CO.,LTD",
  nameTh: "บริษัท ฮับดี ทรานสปอร์ต จำกัด",
} as const;

const HUPDEE_SHARED = {
  registrationNo: "0905553000536",
  addressLines: ["189 Moo 1 Samnakkham Sadao Songkhla 90320"],
  phone: "Tel: 074-301 602",
  terms: "Net 7 days",
  computerGeneratedNote:
    "This is computer generated invoice no signature required",
} as const;

export const HUPDEE_MODE1A_BBL_INVOICE_DETAILS = {
  ...HUPDEE_SHARED,
  bankAccount: "Bangkok Bank 259-310-7044",
} as const;

export const HUPDEE_MODE1A_KBANK_INVOICE_DETAILS = {
  ...HUPDEE_SHARED,
  bankAccount: "Kasikorn Bank 101-1-05020-0",
} as const;
