import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../services/api';
import { TableSkeleton } from '../components/ui/Skeleton';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, resource],
    queryFn: () => auditApi.list({ page, limit: 50, ...(resource ? { resource } : {}) }).then(r => r.data.data),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-accent">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Every create, update and delete in the system</p>
      </div>

      <div className="card mb-4 flex items-center gap-4">
        <div>
          <label className="label">Filter by resource</label>
          <select className="input w-48" value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}>
            <option value="">All resources</option>
            {[
              'order', 'invoice', 'payment', 'customer', 'employee', 'delivery', 'expense', 'expense_category',
              'payroll', 'production', 'supplier', 'inventory', 'proforma', 'attendance', 'reconciliation',
              'price_catalogue', 'settings', 'import', 'kiln', 'auth',
            ].map(r => (
              <option key={r} value={r}>{r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
            ))}
          </select>
        </div>
        <div className="text-sm text-muted-foreground pt-4">{total.toLocaleString()} records</div>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Time', 'User', 'Action', 'Resource', 'Resource ID', 'Details'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 font-medium">{log.user_name || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>{log.action}</span>
                    </td>
                    <td className="px-3 py-2 capitalize">{log.resource}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{log.resource_id ? log.resource_id.slice(0, 8) + '...' : '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                      {log.new_values ? JSON.stringify(log.new_values).slice(0, 80) + '...' : '—'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No audit records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > 50 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-sm">
            <button className="btn-outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <span className="text-muted-foreground">Page {page} of {Math.ceil(total / 50)}</span>
            <button className="btn-outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
