import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Factory, Package, ShoppingCart, DollarSign, AlertTriangle, Plus } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import Badge, { statusBadge } from '../components/ui/Badge';
import { fmtRWF, fmtDate } from '../hooks/useToastHelper';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get().then(r => r.data.data) });

  const kpis = data?.kpis || {};
  const productionChart = data?.productionChart || [];
  const revenueChart = data?.revenueChart || [];
  const recentOrders = data?.recentOrders || [];
  const lowStockAlerts = data?.lowStockAlerts || [];

  const quickActions = [
    { label: 'New Order', color: 'btn-primary', action: () => navigate('/orders') },
    { label: 'New Payroll Run', color: 'btn-secondary', action: () => navigate('/payroll') },
    { label: 'Record Attendance', color: 'btn-outline', action: () => navigate('/attendance') },
    { label: 'Add Batch', color: 'btn-outline', action: () => navigate('/production') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">Dashboard</h1>
        <div className="flex gap-2">
          {quickActions.map(a => (
            <button key={a.label} onClick={a.action} className={a.color + ' text-xs px-3 py-1.5'}>{a.label}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Factory} label="Bricks Today" value={isLoading ? '...' : kpis.bricksToday?.toLocaleString() || '0'} color="text-primary" />
        <KpiCard icon={Package} label="Total Stock" value={isLoading ? '...' : kpis.totalStock?.toLocaleString() || '0'} color="text-success" />
        <KpiCard icon={ShoppingCart} label="Pending Orders" value={isLoading ? '...' : kpis.pendingOrders || '0'} color="text-warning" />
        <KpiCard icon={DollarSign} label="Unpaid Invoices" value={isLoading ? '...' : fmtRWF(kpis.unpaidTotal || 0)} color="text-danger" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-accent mb-4">Production over the Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2D9D0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="produced" fill="#C0392B" radius={[3, 3, 0, 0]} name="Produced" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-accent mb-4">Revenue vs Expenses over 6 Months</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2D9D0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
              <Tooltip formatter={(v: any) => fmtRWF(v)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#27AE60" strokeWidth={2} name="Revenue" dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#E74C3C" strokeWidth={2} name="Expenses" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-accent mb-4">Recent Orders</h3>
          {isLoading ? <TableSkeleton rows={5} cols={3} /> : (
            <table className="w-full text-sm">
              <thead><tr className="table-header"><th className="px-3 py-2 text-left rounded-l">Customer</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left rounded-r">Status</th></tr></thead>
              <tbody>
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-border hover:bg-background cursor-pointer" onClick={() => navigate('/orders')}>
                    <td className="px-3 py-2 font-medium">{o.customer?.company_name || o.customer?.full_name || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(o.order_date)}</td>
                    <td className="px-3 py-2"><Badge variant={statusBadge(o.status)}>{o.status}</Badge></td>
                  </tr>
                ))}
                {recentOrders.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No orders yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-accent mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" /> Low Stock Alerts
          </h3>
          {lowStockAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All stock levels are adequate</p>
          ) : (
            <div className="space-y-2">
              {lowStockAlerts.map((a: any) => (
                <div key={a.material_type} className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{a.material_type.replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground">Current: {a.current} {a.unit}</div>
                  </div>
                  <Badge variant="warning">Below {a.threshold} {a.unit}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
