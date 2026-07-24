import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ArrowLeft, Lock, FileText, Pencil, CheckCircle2 } from 'lucide-react';
import { payrollApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import Badge, { statusBadge } from '../components/ui/Badge';
import { getErrorMessage, MONTHS, fmtRWF } from '../hooks/useToastHelper';

export default function PayrollRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Modal state for editing an entry
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editGross, setEditGross] = useState('');
  const [editBonus, setEditBonus] = useState('');
  const [editDeduction, setEditDeduction] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll', runId],
    queryFn: () => payrollApi.get(runId!).then(r => r.data.data),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: any }) =>
      payrollApi.updateEntry(runId!, entryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', runId] });
      toast('Entry updated', 'success');
      setEditEntry(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const finalize = useMutation({
    mutationFn: () => payrollApi.finalize(runId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', runId] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast('Payroll run finalized successfully', 'success');
      setConfirmFinalize(false);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function openEdit(entry: any) {
    setEditEntry(entry);
    setEditGross(String(entry.gross_salary));
    setEditBonus(String(entry.bonus || 0));
    setEditDeduction(String(entry.deduction || 0));
    setEditStatus(entry.payment_status);
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    updateEntry.mutate({
      entryId: editEntry.id,
      data: {
        gross_salary: Number(editGross),
        bonus: Number(editBonus),
        deduction: Number(editDeduction),
        payment_status: editStatus,
        payment_date: editStatus === 'PAID' ? new Date().toISOString() : null,
      },
    });
  }

  const editNetPreview = Number(editGross || 0) + Number(editBonus || 0) - Number(editDeduction || 0);

  function handleExport() {
    payrollApi.export(runId!).catch(err => toast(getErrorMessage(err), 'error'));
  }

  function handlePayslip(employeeId: string) {
    payrollApi.downloadPayslip(runId!, employeeId).catch(err => toast(getErrorMessage(err), 'error'));
  }

  if (isLoading) return <div className="p-6"><TableSkeleton /></div>;
  if (!run) return <div className="p-6 text-muted-foreground">Payroll run not found</div>;

  const period = `${MONTHS[run.month - 1]} ${run.year}`;
  const totalNet = run.entries?.reduce((s: number, e: any) => s + e.net_salary, 0) || 0;
  const paidCount = run.entries?.filter((e: any) => e.payment_status === 'PAID').length || 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/payroll')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
        <ArrowLeft size={14} /> Back to Payroll
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent">{period} Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {run.entries?.length} employees · Total: <strong className="text-accent">{fmtRWF(totalNet)}</strong>
            {' · '}{paidCount} paid
          </p>
        </div>
        <div className="flex gap-2">
          {!run.finalized && (
            <button
              className="btn-outline flex items-center gap-2"
              onClick={() => setConfirmFinalize(true)}
            >
              <Lock size={14} /> Finalize Run
            </button>
          )}
          {run.finalized && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 size={16} /> Finalized
              </span>
              <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
                <Download size={14} /> Export Bank File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-accent">{run.entries?.length || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Employees</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary">{fmtRWF(totalNet)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Net Payable</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Payments Confirmed</div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                {['Employee', 'Bank', 'Account No.', 'Gross (RWF)', 'Bonus', 'Deduction', 'Net Salary (RWF)', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.entries?.map((entry: any) => (
                <tr key={entry.id} className="border-b border-border hover:bg-background">
                  <td className="px-3 py-3 font-medium">{entry.employee?.full_name}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{entry.employee?.bank_name || 'Not set'}</td>
                  <td className="px-3 py-3 font-mono text-xs">{entry.employee?.bank_account_number || 'Not set'}</td>
                  <td className="px-3 py-3">{fmtRWF(entry.gross_salary)}</td>
                  <td className="px-3 py-3 text-success">{entry.bonus ? `+${fmtRWF(entry.bonus)}` : '-'}</td>
                  <td className="px-3 py-3 text-danger">{entry.deduction ? `-${fmtRWF(entry.deduction)}` : '-'}</td>
                  <td className="px-3 py-3 font-semibold">{fmtRWF(entry.net_salary)}</td>
                  <td className="px-3 py-3">
                    <Badge variant={statusBadge(entry.payment_status)}>{entry.payment_status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {!run.finalized && (
                        <button
                          onClick={() => openEdit(entry)}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                          title="Edit salary / status"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handlePayslip(entry.employeeId)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        title="Download payslip"
                      >
                        <FileText size={12} /> Download Payslip
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit entry modal */}
      <Modal isOpen={!!editEntry} onClose={() => setEditEntry(null)} title={`Edit Entry for ${editEntry?.employee?.full_name}`}>
        {editEntry && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="bg-background rounded-lg p-3 text-sm space-y-1">
              <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{editEntry.employee?.bank_name || 'Not set'}</span></div>
              <div><span className="text-gray-500">Account:</span> <span className="font-mono">{editEntry.employee?.bank_account_number || 'Not set'}</span></div>
              <div><span className="text-gray-500">Narration:</span> <span>{editEntry.narration}</span></div>
            </div>
            <div>
              <label className="label">Gross Salary (RWF) <span className="text-primary">*</span></label>
              <input
                type="number"
                className="input"
                value={editGross}
                onChange={e => setEditGross(e.target.value)}
                min={0}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bonus (RWF)</label>
                <input type="number" className="input" value={editBonus} onChange={e => setEditBonus(e.target.value)} min={0} />
              </div>
              <div>
                <label className="label">Deduction (RWF)</label>
                <input type="number" className="input" value={editDeduction} onChange={e => setEditDeduction(e.target.value)} min={0} />
              </div>
            </div>
            <div className="bg-background rounded-lg p-3 text-sm flex justify-between items-center">
              <span className="text-gray-500">Net Salary</span>
              <span className="text-lg font-semibold text-accent">{fmtRWF(editNetPreview)}</span>
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <button type="button" className="btn-secondary" onClick={() => setEditEntry(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateEntry.isPending}>
                {updateEntry.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Finalize confirmation */}
      {confirmFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmFinalize(false)} />
          <div className="relative bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center">
                <Lock size={20} className="text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-accent">Finalize Payroll Run</h3>
                <p className="text-sm text-gray-500">This will lock all entries and enable bank export. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmFinalize(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => finalize.mutate()} disabled={finalize.isPending} className="btn-primary">
                {finalize.isPending ? 'Finalizing...' : 'Yes, Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
