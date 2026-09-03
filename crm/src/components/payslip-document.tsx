"use client";

import { Printer } from "lucide-react";

import { MONTH_LABEL } from "@/lib/constants";
import type { Payslip } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

import { Button } from "./ui";
import { SimpleDocumentFooter, SimpleDocumentHeader, type Company } from "./simple-document";

/**
 * The printable payslip — shared by the admin payslip detail page
 * (payroll/[id]) and the employee self-service "My Payslips" view, so the
 * two never drift out of sync. window.print() is the same pattern every
 * other printable document in this codebase uses (SimpleDocumentHeader/
 * Footer's own callers — Quotation, Purchase Order, Proforma Invoice —
 * plus the letterhead-based ones), not a new one invented for payroll.
 */
export function PayslipDocument({ payslip, company, onClose }: { payslip: Payslip; company: Company; onClose: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl bg-white p-4 text-[11px] leading-snug text-ink-900 print:p-0">
        <SimpleDocumentHeader company={company} docLabel="Payslip" docNumber={payslip.number} />

        <p className="mb-2 text-center text-sm font-semibold">
          Payslip for the month of {MONTH_LABEL[payslip.month - 1]} {payslip.year}
        </p>

        <div className="grid grid-cols-2 border border-ink-400">
          <div className={cn(gridCell, "border-r-0")}><p className={gridLabel}>Employee ID</p><p className="font-medium">{payslip.uid.slice(0, 10)}</p></div>
          <div className={gridCell}><p className={gridLabel}>Name</p><p className="font-medium">{payslip.employeeName}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>Department</p><p>{payslip.departmentName || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>Designation</p><p>{payslip.designation || "—"}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>PF No.</p><p>{payslip.pfNo || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>UAN No.</p><p>{payslip.uanNo || "—"}</p></div>
          <div className={cn(gridCell, "border-r-0 border-t-0")}><p className={gridLabel}>E.S.I No.</p><p>{payslip.esiNo || "—"}</p></div>
          <div className={cn(gridCell, "border-t-0")}><p className={gridLabel}>Salary Account No.</p><p>{payslip.bankAccountNo || "—"}</p></div>
        </div>

        <div className={cn(gridCell, "border-t-0")}>
          <p className={gridLabel}>Attendance details</p>
          <p>
            Month Days: <span className="font-medium">{payslip.monthDays}</span> &nbsp;|&nbsp;
            Paid Days: <span className="font-medium">{payslip.paidDays}</span> &nbsp;|&nbsp;
            Absent: <span className="font-medium">{payslip.absentDays}</span> &nbsp;|&nbsp;
            Half Day: <span className="font-medium">{payslip.halfDays}</span>
          </p>
        </div>

        <p className="mt-3 mb-1 font-semibold">Payout details (Amount in Rupees)</p>
        <table className="w-full border-collapse border border-ink-400">
          <thead>
            <tr className="text-left">
              <th className={gridCell}>Additions</th>
              <th className={cn(gridCell, "text-right")}>Salary Structure</th>
              <th className={cn(gridCell, "text-right")}>Payout</th>
              <th className={gridCell}>Deduction</th>
              <th className={cn(gridCell, "text-right")}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={gridCell}>Basic</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.basic)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.basic)}</td>
              <td className={gridCell}>E.P.F.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.epfEmployee ? formatINR(payslip.epfEmployee) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>H.R.A.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.hra)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.hra)}</td>
              <td className={gridCell}>E.S.I.C.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.esicEmployee ? formatINR(payslip.esicEmployee) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>T.A.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.ta)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.ta)}</td>
              <td className={gridCell}>TDS</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.tds ? formatINR(payslip.tds) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>Others</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.others)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.others)}</td>
              <td className={gridCell}>OTHER</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.otherDeduction ? formatINR(payslip.otherDeduction) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell}>Misc.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.misc ? formatINR(payslip.misc) : "—"}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.misc ? formatINR(payslip.misc) : "—"}</td>
              <td className={gridCell}>Misc.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.miscDeduction ? formatINR(payslip.miscDeduction) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Loss of Pay</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.lossOfPay ? formatINR(payslip.lossOfPay) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={cn(gridCell, "font-medium")}>ADDITIONAL (ER)</td><td className={gridCell} />
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>E.P.F.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.epfEmployer ? formatINR(payslip.epfEmployer) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>E.S.I.C.</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.esicEmployer ? formatINR(payslip.esicEmployer) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Gratuity</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.gratuity ? formatINR(payslip.gratuity) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Bonus</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.bonus ? formatINR(payslip.bonus) : "—"}</td>
            </tr>
            <tr>
              <td className={gridCell} /><td className={gridCell} /><td className={gridCell} />
              <td className={gridCell}>Health</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{payslip.health ? formatINR(payslip.health) : "—"}</td>
            </tr>
            <tr className="font-semibold">
              <td className={gridCell}>Total</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.grossEarning)}</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.grossEarning)}</td>
              <td className={gridCell}>Total</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(payslip.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>

        <div className={cn(gridCell, "border-t-0 flex flex-wrap justify-between gap-3")}>
          <p>Gross Salary: <span className="font-semibold">{formatINR(payslip.grossEarning)}</span></p>
          <p>Net Salary/Payout: <span className="font-semibold">{formatINR(payslip.netPay)}</span></p>
        </div>
        <div className={cn(gridCell, "border-t-0")}>
          <p>CTC: <span className="font-semibold">{formatINR(payslip.ctc)}</span></p>
        </div>

        <p className="mt-4 text-center text-[10px] text-ink-500">This is a computer generated payslip and does not require any signature</p>

        <SimpleDocumentFooter company={company} />
      </article>
    </div>
  );
}

const gridCell = "border border-ink-400 px-2 py-1.5";
const gridLabel = "text-[10px] text-ink-500";
