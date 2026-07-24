import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { orderApi } from '../services/api';
import { fmtDate, fmtRWF } from '../hooks/useToastHelper';
import { TableSkeleton } from '../components/ui/Skeleton';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800',
  READY: 'bg-cyan-100 text-cyan-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function CustomerStatementPage() {
  const { customerId } = useParams<{ customerId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-statement', customerId],
    queryFn: () => orderApi.getStatement(customerId!).then(r => r.data.data),
    enabled: !!customerId,
  });

  if (isLoading) return <div className="p-8"><TableSkeleton /></div>;
  if (!data) return null;

  const { customer, orders, summary } = data;
  const name = customer.company_name || customer.full_name || 'Customer';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/customers" className="text-muted-foreground hover:text-accent transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-accent">{name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Account statement</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-outline flex items-center gap-2 no-print">
          <Printer size={15} /> Print
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Ordered', value: fmtRWF(summary.totalOrdered) },
          { label: 'Total Invoiced', value: fmtRWF(summary.totalInvoiced) },
          { label: 'Total Paid', value: fmtRWF(summary.totalPaid) },
          { label: 'Outstanding Balance', value: fmtRWF(summary.outstanding), danger: summary.outstanding > 0 },
        ].map(({ label, value, danger }) => (
          <div key={label} className="kpi-card">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold mt-1 ${danger ? 'text-danger' : 'text-accent'}`}>{value}</p>
          </div>
        ))}
      </div>

      {summary.creditLimit > 0 && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm border ${summary.outstanding > summary.creditLimit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          Credit limit: {fmtRWF(summary.creditLimit)} &nbsp;|&nbsp; Used: {fmtRWF(summary.outstanding)} &nbsp;|&nbsp; Available: {fmtRWF(Math.max(0, summary.creditLimit - summary.outstanding))}
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-accent mb-4">Order History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                {['Order Date', 'Brick Type', 'Qty', 'Amount', 'Status', 'Invoiced', 'Paid', 'Balance'].map(h => (
                  <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => {
                const invoiced = o.invoices.reduce((s: number, i: any) => s + i.total, 0);
                const paid = o.invoices.reduce((s: number, i: any) =>
                  s + i.payments.reduce((ps: number, p: any) => ps + p.amount, 0), 0);
                return (
                  <tr key={o.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3">{fmtDate(o.order_date)}</td>
                    <td className="px-3 py-3">{(o.brick_type || '').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-3">{o.quantity.toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold">{fmtRWF(o.total_amount)}</td>
                    <td className="px-3 py-3">
                      <span className={`badge ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-3">{fmtRWF(invoiced)}</td>
                    <td className="px-3 py-3 text-green-700">{fmtRWF(paid)}</td>
                    <td className={`px-3 py-3 font-semibold ${invoiced - paid > 0 ? 'text-danger' : 'text-green-700'}`}>
                      {fmtRWF(invoiced - paid)}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No orders yet for this customer.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
