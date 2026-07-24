import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download } from 'lucide-react';
import { reportApi, payrollApi } from '../services/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import Badge, { statusBadge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { fmtDate, fmtRWF, MONTHS, getErrorMessage } from '../hooks/useToastHelper';
import { getBrickLabel } from '../constants/products';

type ReportType = 'production' | 'sales' | 'payroll' | 'financials';

export default function ReportsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ReportType>('production');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear] = useState(new Date().getFullYear());

  const prodQuery = useQuery({
    queryKey: ['report-production', from, to],
    queryFn: () => reportApi.production({ from, to }).then(r => r.data.data),
    enabled: tab === 'production',
  });
  const salesQuery = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: () => reportApi.sales({ from, to }).then(r => r.data.data),
    enabled: tab === 'sales',
  });
  const payrollQuery = useQuery({
    queryKey: ['report-payroll', payMonth, payYear],
    queryFn: () => reportApi.payroll({ month: payMonth, year: payYear }).then(r => r.data.data),
    enabled: tab === 'payroll',
  });
  const finQuery = useQuery({
    queryKey: ['report-financials', from, to],
    queryFn: () => reportApi.financials({ from, to }).then(r => r.data.data),
    enabled: tab === 'financials',
  });

  const tabs: { key: ReportType; label: string }[] = [
    { key: 'production', label: 'Production' },
    { key: 'sales', label: 'Sales' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'financials', label: 'Financial P&L' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">Reports</h1>
        <button className="btn-outline flex items-center gap-2 no-print" onClick={() => window.print()}>
          <Printer size={14} /> Print / PDF
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-background p-1 rounded-lg w-fit no-print">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-surface shadow text-accent' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CSV Exports */}
      {(tab === 'sales' || tab === 'financials') && (
        <div className="flex gap-2 flex-wrap no-print">
          {tab === 'sales' && (
            <button
              onClick={() => reportApi.exportInvoices({ from, to }).catch(err => toast(getErrorMessage(err), 'error'))}
              className="btn-outline flex items-center gap-1.5 text-sm"
            >
              <Download size={14} /> Invoices CSV
            </button>
          )}
          {tab === 'financials' && (
            <>
              <button
                onClick={() => reportApi.exportExpenses({ from, to }).catch(err => toast(getErrorMessage(err), 'error'))}
                className="btn-outline flex items-center gap-1.5 text-sm"
              >
                <Download size={14} /> Expenses CSV
              </button>
              <button
                onClick={() => reportApi.exportPayments({ from, to }).catch(err => toast(getErrorMessage(err), 'error'))}
                className="btn-outline flex items-center gap-1.5 text-sm"
              >
                <Download size={14} /> Payments CSV
              </button>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      {tab !== 'payroll' && (
        <div className="card flex gap-4 items-center no-print">
          <div><label className="label">From</label><input type="date" className="input w-36" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input w-36" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      )}
      {tab === 'payroll' && (
        <div className="card flex gap-4 items-center no-print">
          <div><label className="label">Month</label>
            <select className="input w-36" value={payMonth} onChange={e => setPayMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Year</label><input type="number" className="input w-24" value={payYear} onChange={e => setPayYear(Number(e.target.value))} /></div>
        </div>
      )}

      {/* Production Report */}
      {tab === 'production' && (
        <div className="card">
          <h2 className="font-semibold text-accent mb-4">Production Report</h2>
          {prodQuery.isLoading ? <TableSkeleton /> : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{prodQuery.data?.totalProduced?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Produced</div>
                </div>
                <div className="p-4 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-danger">{prodQuery.data?.totalRejected?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Rejected</div>
                </div>
                <div className="p-4 bg-background rounded-lg text-center">
                  <div className="text-2xl font-bold text-warning">{prodQuery.data?.rejectionRate}%</div>
                  <div className="text-xs text-muted-foreground">Rejection Rate</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    {['Date','Shift','Kiln','Produced','Rejected','Stage'].map(h => (
                      <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prodQuery.data?.batches?.map((b: any) => (
                    <tr key={b.id} className="border-b border-border">
                      <td className="px-3 py-3">{fmtDate(b.date)}</td>
                      <td className="px-3 py-3">{b.shift}</td>
                      <td className="px-3 py-3">{b.kiln_number}</td>
                      <td className="px-3 py-3 font-medium">{b.bricks_produced?.toLocaleString()}</td>
                      <td className="px-3 py-3 text-danger">{b.bricks_rejected?.toLocaleString()}</td>
                      <td className="px-3 py-3">{b.current_stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Sales Report */}
      {tab === 'sales' && (
        <div className="card">
          <h2 className="font-semibold text-accent mb-4">Sales Report</h2>
          {salesQuery.isLoading ? <TableSkeleton /> : (
            <>
              <div className="p-4 bg-background rounded-lg mb-6 text-center w-fit">
                <div className="text-2xl font-bold text-success">{fmtRWF(salesQuery.data?.totalRevenue || 0)}</div>
                <div className="text-xs text-muted-foreground">Total Revenue</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    {['Date','Customer','Brick Type','Qty','Total','Status'].map(h => (
                      <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salesQuery.data?.orders?.map((o: any) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="px-3 py-3">{fmtDate(o.order_date)}</td>
                      <td className="px-3 py-3">{o.customer?.company_name || o.customer?.full_name}</td>
                      <td className="px-3 py-3">{getBrickLabel(o.brick_type, o.custom_name)}</td>
                      <td className="px-3 py-3">{o.quantity?.toLocaleString()}</td>
                      <td className="px-3 py-3 font-medium">{fmtRWF(o.total_amount)}</td>
                      <td className="px-3 py-3"><Badge variant={statusBadge(o.status)}>{o.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Payroll Report */}
      {tab === 'payroll' && (
        <div className="card">
          <h2 className="font-semibold text-accent mb-4">Payroll Report</h2>
          {payrollQuery.isLoading ? <TableSkeleton /> : (
            payrollQuery.data?.map((run: any) => (
              <div key={run.id} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{MONTHS[run.month - 1]} {run.year}</h3>
                  {run.finalized && (
                    <button
                      onClick={() => payrollApi.export(run.id).catch(err => toast(getErrorMessage(err), 'error'))}
                      className="btn-primary flex items-center gap-1 text-xs no-print"
                    >
                      <Download size={12} /> Bank Export
                    </button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header">
                      {['Employee','Gross Salary','Net Salary','Status'].map(h => (
                        <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.entries?.map((e: any) => (
                      <tr key={e.id} className="border-b border-border">
                        <td className="px-3 py-3 font-medium">{e.employee?.full_name}</td>
                        <td className="px-3 py-3">{fmtRWF(e.gross_salary)}</td>
                        <td className="px-3 py-3">{fmtRWF(e.net_salary)}</td>
                        <td className="px-3 py-3"><Badge variant={statusBadge(e.payment_status)}>{e.payment_status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          {payrollQuery.data?.length === 0 && <p className="text-muted-foreground text-sm">No payroll runs for this period</p>}
        </div>
      )}

      {/* Financial P&L */}
      {tab === 'financials' && (
        <div className="card">
          <h2 className="font-semibold text-accent mb-4">Financial P&L Report</h2>
          {finQuery.isLoading ? <TableSkeleton rows={4} cols={2} /> : (
            <div className="space-y-4">
              <table className="w-full text-sm max-w-md">
                <tbody>
                  {[
                    ['Income', finQuery.data?.income || 0, 'text-success'],
                    ['Raw Material Costs', finQuery.data?.expenses?.rawMaterials || 0, 'text-danger'],
                    ['Payroll Costs', finQuery.data?.expenses?.payroll || 0, 'text-danger'],
                    ['Delivery Costs', finQuery.data?.expenses?.delivery || 0, 'text-danger'],
                    ['Manual Expenses', finQuery.data?.expenses?.manual || 0, 'text-danger'],
                    ['Total Expenses', finQuery.data?.expenses?.total || 0, 'text-danger font-bold'],
                    ['NET PROFIT / LOSS', (finQuery.data?.income || 0) - (finQuery.data?.expenses?.total || 0), finQuery.data?.profit >= 0 ? 'text-success font-bold text-lg' : 'text-danger font-bold text-lg'],
                  ].map(([k, v, cls]) => (
                    <tr key={k as string} className="border-b border-border">
                      <td className="px-3 py-3 font-medium">{k as string}</td>
                      <td className={`px-3 py-3 text-right ${cls as string}`}>{fmtRWF(Number(v))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
