/** Area block titles for the Crate Type Record summary report. */
export const CRATE_TYPE_RECORD_BLOCKS: {
  title: string;
  codes: string[];
}[] = [
  { title: "KUALA LUMPUR", codes: ["KL", "BP", "MP", "SL"] },
  { title: "MELAKA", codes: ["MC"] },
  { title: "IPOH", codes: ["A"] },
  { title: "BUKIT MERTAJAM", codes: ["BM"] },
  { title: "PENANG", codes: ["P"] },
  { title: "TAIPING", codes: ["TP"] },
  { title: "NIBONG TEBAL", codes: ["NT"] },
  { title: "TANJUNG PIANDANG", codes: ["KT"] },
  { title: "SIMPANG AMPAT", codes: ["SA"] },
  { title: "KEDAH", codes: ["KD"] },
  { title: "JOHOR BAHRU", codes: ["JB"] },
];

const CODE_TO_BLOCK_TITLE = new Map<string, string>();
for (const block of CRATE_TYPE_RECORD_BLOCKS) {
  for (const code of block.codes) {
    CODE_TO_BLOCK_TITLE.set(code, block.title);
  }
}

export function getCrateTypeRecordBlockTitle(marketCode: string): string | null {
  return CODE_TO_BLOCK_TITLE.get(marketCode) ?? null;
}
