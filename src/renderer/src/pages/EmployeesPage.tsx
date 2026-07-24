import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { employeeApi } from '../services/api';
import { Employee } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import { getErrorMessage, BANK_CODES, fmtDate } from '../hooks/useToastHelper';

const WAGE_TYPES = ['MONTHLY', 'DAILY', 'PIECE_RATE'];

const EMPTY: Partial<Employee> = {
  full_name: '', national_id: '', phone: '', job_title: '',
  wage_type: 'MONTHLY', base_salary: 0, bank_name: '', bank_account_number: '', is_active: true
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list().then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (data: any) => selected
      ? employeeApi.update(selected.id, data)
      : employeeApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast(selected ? 'Employee updated' : 'Employee created', 'success');
      setModal(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => employeeApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast('Employee deleted', 'success'); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function openCreate() { setSelected(null); setForm({ ...EMPTY }); setModal('create'); }
  function openEdit(e: Employee) { setSelected(e); setForm({ ...e }); setModal('edit'); }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (employees as Employee[]).filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.job_title ?? '').toLowerCase().includes(q) ||
      (e.bank_name ?? '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent">Employees</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="card mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, job title or bank..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Full Name','Job Title','Wage Type','Bank','Account No','Status','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: Employee) => (
                  <tr key={e.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3 font-medium">{e.full_name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{e.job_title || '-'}</td>
                    <td className="px-3 py-3">{e.wage_type}</td>
                    <td className="px-3 py-3 text-xs">{e.bank_name || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{e.bank_account_number || '-'}</td>
                    <td className="px-3 py-3">
                      <Badge variant={e.is_active ? 'success' : 'muted'}>{e.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-background rounded text-accent"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteId(e.id)} className="p-1.5 hover:bg-background rounded text-danger"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Employee' : 'Add Employee'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Full Name <span className="text-primary">*</span></label>
            <input className="input" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} required placeholder="LAST NAME First Name" />
          </div>
          <div>
            <label className="label">National ID</label>
            <input className="input" value={form.national_id || ''} onChange={e => setForm({ ...form, national_id: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Job Title</label>
            <input className="input" value={form.job_title || ''} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div>
            <label className="label">Hire Date</label>
            <input type="date" className="input" value={form.hire_date ? form.hire_date.slice(0,10) : ''} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Wage Type</label>
            <select className="input" value={form.wage_type || 'MONTHLY'} onChange={e => setForm({ ...form, wage_type: e.target.value })}>
              {WAGE_TYPES.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Base Salary (RWF)</label>
            <input type="number" className="input" value={form.base_salary || 0} onChange={e => setForm({ ...form, base_salary: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="label">Bank Name</label>
            <select className="input" value={form.bank_name || ''} onChange={e => setForm({ ...form, bank_name: e.target.value })}>
              <option value="">-- Select Bank --</option>
              {BANK_CODES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Bank Account Number</label>
            <input className="input" value={form.bank_account_number || ''} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            <label htmlFor="is_active" className="text-sm">Active</label>
          </div>
          <div className="col-span-2 flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Employee"
        message="This will deactivate the employee record. Continue?"
        onConfirm={() => { remove.mutate(deleteId!); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
