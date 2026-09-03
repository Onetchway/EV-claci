"use client";

import type { TallySettings } from "./db/settings";
import type { LineItem } from "./types";
import { toDate } from "./utils";

type MaybeTS = Parameters<typeof toDate>[0];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tallyDate(value: MaybeTS): string {
  const d = toDate(value) ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function amt(n: number): string {
  return n.toFixed(2);
}

function itemsNarration(items: LineItem[]): string {
  return items
    .map((it) => `${it.description} - Qty ${it.qty}${it.unit ? ` ${it.unit}` : ""} @ Rs.${it.rate}${it.hsnCode ? ` (HSN ${it.hsnCode})` : ""} = Rs.${it.amount.toFixed(2)}`)
    .join("; ");
}

interface VoucherInput {
  vchType: "Purchase" | "Sales";
  vchNumber: string;
  date: MaybeTS;
  partyName: string;
  narration: string;
  subtotal: number;
  gstType?: "IGST" | "CGST_SGST";
  igstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  taxAmount: number;
  total: number;
}

/**
 * Builds a Tally-importable XML envelope for one accounting voucher (Purchase, from a PO,
 * or Sales, from a PI). Ledger entries follow Tally's own sign convention -- debit entries
 * carry ISDEEMEDPOSITIVE=Yes with a negative amount, credit entries ISDEEMEDPOSITIVE=No with
 * a positive amount, and every voucher's entries sum to zero.
 *
 * This is a ledger-only voucher (no stock items) -- line items are listed in the narration
 * for reference, but tax and account totals are what post to the books. Party and tax ledger
 * names must already exist in the destination Tally company (see Settings -> Tally
 * integration) or Tally will flag them as unrecognized on import.
 */
function buildVoucherXml(v: VoucherInput, tally: TallySettings, companyName: string): string {
  const isPurchase = v.vchType === "Purchase";
  const accountLedger = isPurchase ? tally.purchaseLedger : tally.salesLedger;

  const entries: { name: string; amount: number; debit: boolean }[] = [
    { name: v.partyName, amount: v.total, debit: !isPurchase },
    { name: accountLedger, amount: v.subtotal, debit: isPurchase },
  ];
  if (v.gstType === "CGST_SGST") {
    if (v.cgstAmount) entries.push({ name: tally.cgstLedger, amount: v.cgstAmount, debit: isPurchase });
    if (v.sgstAmount) entries.push({ name: tally.sgstLedger, amount: v.sgstAmount, debit: isPurchase });
  } else if (v.taxAmount) {
    entries.push({ name: tally.igstLedger, amount: v.igstAmount ?? v.taxAmount, debit: isPurchase });
  }

  const ledgerXml = entries
    .filter((e) => e.amount)
    .map(
      (e) => `      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${escapeXml(e.name)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>${e.debit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
       <AMOUNT>${e.debit ? "-" : ""}${amt(e.amount)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`,
    )
    .join("\n");

  return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${v.vchType}" ACTION="Create">
      <DATE>${tallyDate(v.date)}</DATE>
      <NARRATION>${escapeXml(v.narration)}</NARRATION>
      <VOUCHERTYPENAME>${v.vchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(v.vchNumber)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${escapeXml(v.partyName)}</PARTYLEDGERNAME>
${ledgerXml}
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

export function buildPurchaseOrderTallyXml(
  po: { poNo: string; poDate: MaybeTS; vendorName: string; items: LineItem[]; subtotal: number; taxAmount: number; gstType?: "IGST" | "CGST_SGST"; igstAmount?: number; cgstAmount?: number; sgstAmount?: number; totalAmount: number },
  tally: TallySettings,
  companyName: string,
): string {
  return buildVoucherXml(
    {
      vchType: "Purchase",
      vchNumber: po.poNo,
      date: po.poDate,
      partyName: po.vendorName,
      narration: `PO ${po.poNo} - ${itemsNarration(po.items)}`,
      subtotal: po.subtotal,
      gstType: po.gstType,
      igstAmount: po.igstAmount,
      cgstAmount: po.cgstAmount,
      sgstAmount: po.sgstAmount,
      taxAmount: po.taxAmount,
      total: po.totalAmount,
    },
    tally,
    companyName,
  );
}

export function buildProformaInvoiceTallyXml(
  pi: { piNo: string; piDate: MaybeTS; clientName: string; items: LineItem[]; subtotal: number; taxAmount: number; gstType?: "IGST" | "CGST_SGST"; igstAmount?: number; cgstAmount?: number; sgstAmount?: number; totalAmount: number },
  tally: TallySettings,
  companyName: string,
): string {
  return buildVoucherXml(
    {
      vchType: "Sales",
      vchNumber: pi.piNo,
      date: pi.piDate,
      partyName: pi.clientName,
      narration: `PI ${pi.piNo} - ${itemsNarration(pi.items)}`,
      subtotal: pi.subtotal,
      gstType: pi.gstType,
      igstAmount: pi.igstAmount,
      cgstAmount: pi.cgstAmount,
      sgstAmount: pi.sgstAmount,
      taxAmount: pi.taxAmount,
      total: pi.totalAmount,
    },
    tally,
    companyName,
  );
}

export function downloadTallyXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xml") ? filename : `${filename}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
