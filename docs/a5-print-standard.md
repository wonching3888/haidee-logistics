# A5 Print Standard (Landscape, Fixed-Slot)

## Scope
Reference implementation: PV (Payment Voucher) + RV (Receipt Voucher), sharing
`CashBookVoucherA5Document.tsx` + `cash-book-voucher-print.css`. Use this as the
standard pattern for any future A5-printed document in this project.

## Design principle
Retired approach: measure rendered content height, then zoom/scale the whole page
to fit. This caused recurring edge-case bugs across many rounds (over-shrinking,
under-filling, inconsistent margins) because every voucher's content height differed.

Current approach: FIXED layout. A constant number of table "slots" per page
(currently 5), each a fixed height regardless of whether it holds data. Content
beyond the per-page slot count paginates automatically (page-break-after), rather
than shrinking to fit. Every printed page looks identical regardless of line-item
count — verified: 1-line and 5-line landscape fixtures measure the exact same
last-page content height (115.76mm).

## Page geometry
- `@page { size: A5 landscape; margin: 0; }` — orientation set on `@page` directly,
  not a portrait page rotated via CSS.
- All margin comes from element padding, not page margin: `padding: 6mm 5mm` on the
  outer print-page element.
- A5 landscape total height: 148mm. Usable content height: ~138mm. Safety ceiling
  for last-page content (empirically established, leaves buffer against printer/
  driver rounding): 128mm. Target last-page content height: roughly 115–124mm —
  full-looking without hugging the ceiling.

## Layout structure (top to bottom)
1. Topband: 3-column CSS grid — company letterhead | title | voucher no + page
   label. Grid ratio `1.35fr : 1.1fr : 0.85fr`. Border-bottom 0.75pt solid black.
2. Meta strip: flex-wrap row of date / party / extra fields.
3. Fixed-slot table: header row + N slot rows (data or blank) + total row (last
   page only).
4. Amount-in-words strip: bordered box, single line.
5. Signatures: grid of N signer columns, only on the last page. Non-last pages show
   a centered "— continued —" note instead.

## Proven values (PV/RV reference implementation)
- Slots per page: 5. Slot row height: 6.8mm fixed (both `<tr>` and `<td>`).
- Table columns: particulars 79% / amount 21%.
- Font sizes: title 12pt bold; letterhead company name (TH/EN) 12pt bold —
  deliberately matches title; letterhead address/tax-id detail lines 6.5pt;
  topband voucher-no 9pt bold; topband right/page-label 7.5–8pt; meta strip 7.5pt;
  table cells 8pt; amount-in-words strip 7.5pt / amount text 8pt; signatures 7pt,
  sig-name 6.5pt, continued-note 7pt.
- Spacing: meta margin-top 6px; table margin-top 6px; words strip margin-top 8px /
  padding 4px 6px; signatures margin-top 14px; sig-line min-height 14mm.
- These spacing/font values were tuned to fill the page without inflating table row
  height — when a future round needs to use more of the page, prefer growing
  spacing/letterhead/signature area over the table row height. Row height changes
  ripple through every fixture and were themselves an entire earlier tuning saga
  (7.2mm → 5.6mm → 5mm portrait, then re-loosened to 6.8mm for landscape) — treat
  it as tuned/stable, don't reopen it casually.

## Pitfalls to check on any new A5 (or any print) document
1. Shared base style bleed-through: `components/documents/document-print.css` has
   a base rule (`.document-print th, .document-print td { text-align: center; }`)
   applying to every document type sharing the `.document-print` class. A new
   table's body cells will silently inherit CENTER alignment unless the specific
   column gets an explicit override. Fix locally in the document-specific CSS file
   — do not edit the shared base file for a single document type's needs.
2. Zoom-to-fit is retired for this pattern — do not reintroduce dynamic scale/
   transform based on measured content height. A new document type should follow
   the fixed-slot approach from the start.
3. Physical printing (confirmed on the office printer by real tests): bypass/
   manual tray does NOT auto-detect paper size — A5 must be physically loaded AND
   manually selected on the printer's own control panel every time, or it silently
   substitutes A4. The `lp` command must explicitly pass `-o orientation-requested=4`
   for landscape — the printer does not reliably infer orientation from the PDF's
   own MediaBox alone. Known-good flag set for this printer: `InputSlot=manual` +
   `orientation-requested=4` + `print-scaling=none` + correct A5 media/PageSize.

## Verification checklist for any A5 print change
1. DOM/PDF measurement script (see `scripts/_verify-pv-a5-print.ts` as template):
   render 1-item / N-item (exactly fills one page) / N+1-item (forces page 2)
   fixtures. Assert PDF page count, MediaBox (true A5 landscape =
   `"0 0 594.95996 420"` in points), and DOM-measured content height per page
   against the safety ceiling.
2. Screenshot/PDF visual review (alignment, font sizes, spacing) before physical
   printing.
3. Real physical print test — always, before commit. Digital verification alone
   has repeatedly missed printer-hardware-specific issues (paper tray defaults,
   orientation clipping) that only show up on actual paper.
4. Only commit/push after both digital verification and a physical print are
   confirmed clean.

## Reference implementation (copy from these for a new A5 document type)
- `components/cash-book/CashBookVoucherA5Document.tsx` — shared document
  component (pagination + slot padding via `lib/cash-book/voucher-print-pages.ts`)
- `components/cash-book/cash-book-voucher-print.css` — all print CSS
- `scripts/_verify-pv-a5-print.ts` — verification script template
