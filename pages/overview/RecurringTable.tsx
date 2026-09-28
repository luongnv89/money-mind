import React from 'react';
import { Badge, Card, CardContent } from '../../components/UI';
import { Cadence, FinanceModel, formatISODate } from '../../lib/finance';
import { CATEGORY_CHART_COLORS } from '../../constants';

const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export interface RecurringTableProps {
  model: FinanceModel;
  fmt: (n: number) => string;
}

export const RecurringTable: React.FC<RecurringTableProps> = ({ model, fmt }) => {
  const { recurring, recurringTotals } = model;

  if (recurring.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted">
          No recurring charges detected yet — they appear after three regular payments.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Merchant</th>
              <th className="px-3 py-3">Cadence</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Last</th>
              <th className="px-3 py-3 text-right">Monthly</th>
              <th className="px-5 py-3 text-right">Next expected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recurring.map((charge) => (
              <tr key={charge.key} className="transition-colors hover:bg-surface-muted/50">
                <td className="px-5 py-3 font-medium text-ink">{charge.merchant}</td>
                <td className="px-3 py-3">
                  <Badge variant="neutral">{CADENCE_LABEL[charge.cadence]}</Badge>
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-ink"
                    style={{
                      backgroundColor: `${CATEGORY_CHART_COLORS[charge.category] ?? '#9AA0A6'}1A`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: CATEGORY_CHART_COLORS[charge.category] ?? '#9AA0A6',
                      }}
                    />
                    {charge.subCategory ?? charge.category}
                  </span>
                </td>
                <td className="num px-3 py-3 text-right text-ink-soft">{fmt(charge.lastAmount)}</td>
                <td className="num px-3 py-3 text-right font-medium text-ink">
                  {fmt(charge.monthlyEquivalent)}
                </td>
                <td className="num px-5 py-3 text-right text-ink-soft">
                  {formatISODate(charge.nextExpected)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong bg-surface-muted/40 text-sm">
              <td className="px-5 py-3 font-medium text-ink" colSpan={3}>
                {recurringTotals.count} active commitments
              </td>
              <td className="num px-3 py-3 text-right text-ink-soft" />
              <td className="num px-3 py-3 text-right font-semibold text-ink">
                {fmt(recurringTotals.monthly)}/mo
              </td>
              <td className="num px-5 py-3 text-right font-semibold text-ink">
                {fmt(recurringTotals.annual)}/yr
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
};
