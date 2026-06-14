/** Default route master records for initial seed / reference. */
export const DEFAULT_ROUTE_MASTERS = [
  {
    code: "KL",
    name: "KL路线",
    markets: ["KL", "BP", "MP", "SL"],
    displayOrder: 1,
  },
  {
    code: "MC",
    name: "MC路线",
    markets: ["MC"],
    displayOrder: 2,
  },
  {
    code: "A",
    name: "A路线",
    markets: ["A"],
    displayOrder: 3,
  },
  {
    code: "KD",
    name: "KD路线",
    markets: ["KD"],
    displayOrder: 4,
  },
  {
    code: "JB",
    name: "JB路线",
    markets: ["JB"],
    displayOrder: 5,
  },
  {
    code: "BM",
    name: "BM路线",
    markets: ["BM", "P", "TP", "KT", "NT", "SA"],
    displayOrder: 6,
  },
  {
    code: "OTHER",
    name: "OTHER（包车）",
    markets: ["OTHER"],
    displayOrder: 7,
  },
] as const;
