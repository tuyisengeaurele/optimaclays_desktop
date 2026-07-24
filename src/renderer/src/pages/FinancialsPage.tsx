import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { reportApi, expenseApi, expenseCategoryApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { getErrorMessage, fmtDate, fmtRWF } from '../hooks/useToastHelper';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export default function FinancialsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ category: '', amount: 0, date: new Date().toISOString().slice(0,10), description: '' });

  const { data: categoryData = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoryApi.list().then(r => r.data.data),
  });
  const categories: string[] = (categoryData as any[]).map((c: any) => c.name);
  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['financials', from, to],
    queryFn: () => reportApi.financials({ from, to }).then(r => r.data.data),
  });

  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: () => expenseApi.list({ from, to }).then(r => r.data.data),
  });

  const delExpense = useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financials'] }); qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Expense deleted', 'success'); setDeleteExpId(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const addExpense = useMutation({
    mutationFn: (d: any) => expenseApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financials'] }); qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Expense recorded', 'success'); setModal(false); setForm({ category: '', amount: 0, date: new Date().toISOString().slice(0,10), description: '' }); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const profit = data ? data.income - data.expenses?.total : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">Financials</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal(true)}><Plus size={16} /> Add Expense</button>
      </div>

      {/* Date filter */}
      <div className="card flex gap-4 items-center">
        <div><label className="label">From</label><input type="date" className="input w-36" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input w-36" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <TrendingUp size={24} className="text-success mx-auto mb-2" />
          <div className="text-2xl font-bold text-success">{isLoading ? '...' : fmtRWF(data?.income || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Income</div>
        </div>
        <div className="card text-center">
          <TrendingDown size={24} className="text-danger mx-auto mb-2" />
          <div className="text-2xl font-bold text-danger">{isLoading ? '...' : fmtRWF(data?.expenses?.total || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Expenses</div>
        </div>
        <div className="card text-center">
          <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{isLoading ? '...' : fmtRWF(profit)}</div>
          <div className="text-xs text-muted-foreground mt-1">Net Profit / Loss</div>
        </div>
      </div>

      {/* Expense breakdown */}
      {data?.expenses && (
        <div className="card">
          <h3 className="font-semibold text-accent mb-4">Expense Breakdown</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[['Manual Expenses', data.expenses.manual],['Raw Materials', data.expenses.rawMaterials],['Payroll', data.expenses.payroll],['Delivery', data.expenses.delivery]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between p-3 bg-background rounded-lg">
                <span>{k as string}</span>
                <span className="font-medium">{fmtRWF(Number(v) || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense log */}
      <div className="card">
        <h3 className="font-semibold text-accent mb-4">Manual Expenses</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              {['Date','Category','Amount','Description', ...(isAdmin ? [''] : [])].map(h => (
                <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e: any) => (
              <tr key={e.id} className="border-b border-border">
                <td className="px-3 py-3">{fmtDate(e.date)}</td>
                <td className="px-3 py-3">{e.category}</td>
                <td className="px-3 py-3 font-medium">{fmtRWF(e.amount)}</td>
                <td className="px-3 py-3 text-muted-foreground">{e.description || '-'}</td>
                {isAdmin && (
                  <td className="px-3 py-3">
                    <button onClick={() => setDeleteExpId(e.id)} className="text-danger hover:text-red-700" title="Delete expense"><Trash2 size={14} /></button>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No manual expenses recorded</td></tr>}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteExpId}
        title="Delete Expense"
        message="This will permanently remove this expense record. This cannot be undone."
        onConfirm={() => delExpense.mutate(deleteExpId!)}
        onCancel={() => setDeleteExpId(null)}
      />

      <Modal open={modal} onClose={() => setModal(false)} title="Add Manual Expense">
        <form onSubmit={e => { e.preventDefault(); addExpense.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
              <option value="">-- Select --</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Amount (RWF)</label><input type="number" className="input" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} required /></div>
          <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addExpense.isPending}>{addExpense.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
