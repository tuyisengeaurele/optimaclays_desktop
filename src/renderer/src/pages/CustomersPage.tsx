import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { customerApi } from '../services/api';
import { Customer } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtRWF } from '../hooks/useToastHelper';

const EMPTY = { customer_type: 'INDIVIDUAL', full_name: '', phone: '', company_name: '', tin_number: '', contact_person_name: '', contact_person_phone: '', location: '', notes: '', credit_limit: 0 };

export default function CustomersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.list().then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (data: any) => selected ? customerApi.update(selected.id, data) : customerApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast(selected ? 'Customer updated' : 'Customer created', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast('Customer deleted', 'success'); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const [search, setSearch] = useState('');

  function openCreate() { setSelected(null); setForm({ ...EMPTY }); setModal('create'); }
  function openEdit(c: Customer) { setSelected(c); setForm({ ...c }); setModal('edit'); }

  const isCompany = form.customer_type === 'COMPANY';

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (customers as Customer[]).filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.company_name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.location ?? '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent">Customers</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}><Plus size={16} /> Add Customer</button>
      </div>

      <div className="card mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, company, phone or location..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Type','Name / Company','Contact','TIN','Location','Credit Limit','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: Customer) => (
                  <tr key={c.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3"><Badge variant={c.customer_type === 'COMPANY' ? 'info' : 'default'}>{c.customer_type}</Badge></td>
                    <td className="px-3 py-3 font-medium">{c.company_name || c.full_name || '-'}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.contact_person_phone || c.phone || '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{c.tin_number || '-'}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.location || '-'}</td>
                    <td className="px-3 py-3 text-sm">{(c as any).credit_limit > 0 ? fmtRWF((c as any).credit_limit) : <span className="text-muted-foreground">None</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2 items-center">
                        <Link to={`/customers/${c.id}/statement`} className="p-1.5 hover:bg-background rounded text-primary" title="View Statement"><FileText size={14} /></Link>
                        <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-background rounded text-accent" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 hover:bg-background rounded text-danger" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No customers yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Customer' : 'Add Customer'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Customer Type</label>
            <div className="flex gap-4">
              {['INDIVIDUAL','COMPANY'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="customer_type" value={t} checked={form.customer_type === t} onChange={e => setForm({ ...form, customer_type: e.target.value })} />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {!isCompany ? (
            <>
              <div><label className="label">Full Name <span className="text-primary">*</span></label><input className="input" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div><label className="label">Phone <span className="text-primary">*</span></label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
            </>
          ) : (
            <>
              <div><label className="label">Company Name <span className="text-primary">*</span></label><input className="input" value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} required /></div>
              <div><label className="label">TIN Number <span className="text-primary">*</span></label><input className="input" value={form.tin_number || ''} onChange={e => setForm({ ...form, tin_number: e.target.value })} required placeholder="Tax Identification Number" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Contact Person Name</label><input className="input" value={form.contact_person_name || ''} onChange={e => setForm({ ...form, contact_person_name: e.target.value })} /></div>
                <div><label className="label">Contact Phone <span className="text-primary">*</span></label><input className="input" value={form.contact_person_phone || ''} onChange={e => setForm({ ...form, contact_person_phone: e.target.value })} required /></div>
              </div>
            </>
          )}
          <div><label className="label">Location / Address</label><input className="input" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          <div><label className="label">Credit Limit (RWF) <span className="text-xs text-muted-foreground">(0 = no limit)</span></label><input type="number" min={0} className="input" value={form.credit_limit || 0} onChange={e => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Delete Customer" message="This will remove the customer. Continue?" onConfirm={() => { remove.mutate(deleteId!); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
