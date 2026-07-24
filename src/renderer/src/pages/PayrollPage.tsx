import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { payrollApi } from '../services/api';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import Badge, { statusBadge } from '../components/ui/Badge';
import { getErrorMessage, MONTHS, fmtRWF } from '../hooks/useToastHelper';

export default function PayrollPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => payrollApi.list().then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => payrollApi.create({ month, year }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast('Payroll run created', 'success');
      setModal(false);
      navigate(`/payroll/${res.data.data.id}`);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => payrollApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast('Payroll run deleted', 'success');
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-accent">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly payroll runs and bank payment exports</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal(true)}>
          <Plus size={16} /> New Payroll Run
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                {['Period', 'Employees', 'Total Net (RWF)', 'Finalized', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(runs as any[]).map((r: any) => {
                const count = r._count?.entries ?? r.entries?.length ?? 0;
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3 font-medium">{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="px-3 py-3 text-muted-foreground">{count} employees</td>
                    <td className="px-3 py-3 font-medium">
                      {r.entries ? fmtRWF(r.entries.reduce((s: number, e: any) => s + e.net_salary, 0)) : 'Pending'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={r.finalized ? 'success' : 'muted'}>{r.finalized ? 'Yes' : 'No'}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/payroll/${r.id}`)} className="flex items-center gap-1 text-primary hover:underline text-xs">
                          <Eye size={14} /> View
                        </button>
                        {!r.finalized && (
                          <button onClick={() => setDeleteId(r.id)} className="p-1 text-danger hover:bg-background rounded" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No payroll runs yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Payroll Run">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">This will create payroll entries for all active employees using their current base salary. You can adjust individual amounts after creation.</p>
          <div>
            <label className="label">Month</label>
            <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2100} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? 'Creating...' : 'Create Payroll Run'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Payroll Run"
        message="Are you sure? This will permanently delete all entries in this payroll run. Finalized runs cannot be deleted."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
