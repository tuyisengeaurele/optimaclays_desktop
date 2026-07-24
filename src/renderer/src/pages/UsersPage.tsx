import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, ShieldCheck, ShieldOff } from 'lucide-react';
import { authApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage } from '../hooks/useToastHelper';

const ROLES = ['ADMIN', 'PRODUCTION_SUPERVISOR', 'SALES_OFFICER', 'STORE_MANAGER', 'ACCOUNTANT'];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PRODUCTION_SUPERVISOR: 'Production Supervisor',
  SALES_OFFICER: 'Sales Officer',
  STORE_MANAGER: 'Store Manager',
  ACCOUNTANT: 'Accountant',
};

const empty = { email: '', password: '', full_name: '', role: 'SALES_OFFICER' };

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers().then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => authApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast('User created successfully', 'success');
      setModal(null);
    },
    onError: (err: any) => toast(getErrorMessage(err), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => authApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast('User updated', 'success');
      setModal(null);
    },
    onError: (err: any) => toast(getErrorMessage(err), 'error'),
  });

  function openCreate() {
    setForm(empty);
    setSelected(null);
    setModal('create');
  }

  function openEdit(user: any) {
    setSelected(user);
    setForm({ full_name: user.full_name, role: user.role, is_active: user.is_active, password: '' });
    setModal('edit');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modal === 'create') {
      createMutation.mutate(form);
    } else if (selected) {
      const data: any = { full_name: form.full_name, role: form.role, is_active: form.is_active };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: selected.id, data });
    }
  }

  function toggleActive(user: any) {
    updateMutation.mutate({ id: user.id, data: { is_active: !user.is_active } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">System users and access levels</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton rows={5} cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Full Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-border hover:bg-background transition-colors">
                    <td className="px-4 py-3 font-medium text-accent">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit user"
                          className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-accent transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? 'Deactivate user' : 'Activate user'}
                          className="p-1.5 rounded-lg hover:bg-background transition-colors"
                        >
                          {u.is_active
                            ? <ShieldOff size={15} className="text-danger" />
                            : <ShieldCheck size={15} className="text-green-600" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add New User' : 'Edit User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.full_name} onChange={e => setForm((f: any) => ({ ...f, full_name: e.target.value }))} required />
          </div>
          {modal === 'create' && (
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} required />
            </div>
          )}
          <div>
            <label className="label">{modal === 'create' ? 'Password' : 'New Password (leave blank to keep current)'}</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))} required={modal === 'create'} minLength={8} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {modal === 'edit' && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Account Active</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
              {modal === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
