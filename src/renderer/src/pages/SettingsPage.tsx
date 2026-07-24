import React, { useState, useEffect } from 'react';
import { KeyRound, User, Pencil, Building2, Save, Tag, Plus, Trash2 } from 'lucide-react';
import { authApi, settingsApi, expenseCategoryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { getErrorMessage } from '../hooks/useToastHelper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Tab = 'profile' | 'company' | 'categories';

const EMPTY_COMPANY = {
  tin: '',
  bank_name: '',
  bank_account: '',
  phone: '',
  email: '',
  address: '',
  director_name: '',
  director_title: '',
  default_payment_terms: '',
  default_delivery_period: '',
  overdue_grace_days: 0,
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState<Tab>('profile');

  // ── Profile ──
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Password ──
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // ── Company settings ──
  const [companyForm, setCompanyForm] = useState({ ...EMPTY_COMPANY });
  const [editingCompany, setEditingCompany] = useState(false);

  const { data: companyData } = useQuery({
    queryKey: ['settings-company'],
    queryFn: () => settingsApi.getCompany().then(r => r.data.data),
  });

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name || '', email: user.email || '' });
  }, [user?.email, user?.full_name]);

  useEffect(() => {
    if (companyData) {
      setCompanyForm({
        tin:                     companyData.tin                     || '',
        bank_name:               companyData.bank_name               || '',
        bank_account:            companyData.bank_account            || '',
        phone:                   companyData.phone                   || '',
        email:                   companyData.email                   || '',
        address:                 companyData.address                 || '',
        director_name:           companyData.director_name           || '',
        director_title:          companyData.director_title          || '',
        default_payment_terms:   companyData.default_payment_terms   || '',
        default_delivery_period: companyData.default_delivery_period || '',
        overdue_grace_days:      companyData.overdue_grace_days      ?? 0,
      });
    }
  }, [companyData]);

  const updateCompany = useMutation({
    mutationFn: (data: typeof EMPTY_COMPANY) => settingsApi.updateCompany(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-company'] });
      toast('Company settings saved', 'success');
      setEditingCompany(false);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  // Expense categories
  const [newCatName, setNewCatName] = useState('');
  const { data: expCats = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoryApi.list().then(r => r.data.data),
    enabled: isAdmin,
  });
  const addCat = useMutation({
    mutationFn: (name: string) => expenseCategoryApi.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); setNewCatName(''); toast('Category added', 'success'); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });
  const delCat = useMutation({
    mutationFn: (id: string) => expenseCategoryApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); toast('Category removed', 'success'); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.full_name.trim()) return toast('Full name cannot be empty', 'error');
    if (!profileForm.email.trim()) return toast('Email cannot be empty', 'error');
    setProfileLoading(true);
    try {
      await authApi.updateProfile({ full_name: profileForm.full_name, email: profileForm.email });
      await refreshUser();
      toast('Profile updated successfully', 'success');
      setEditingProfile(false);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast('New passwords do not match', 'error');
    if (pwForm.newPassword.length < 8) return toast('Password must be at least 8 characters', 'error');
    setPwLoading(true);
    try {
      await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast('Password changed successfully', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setPwLoading(false);
    }
  }

  function cf(field: keyof typeof EMPTY_COMPANY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setCompanyForm(f => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-accent">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Company setup and account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('profile')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-1.5"><User size={14} /> My Profile</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('company')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'company'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5"><Building2 size={14} /> Company Profile</span>
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setTab('categories')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'categories'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5"><Tag size={14} /> Expense Categories</span>
          </button>
        )}
      </div>

      {/* ── MY PROFILE TAB ── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <User size={18} className="text-accent" />
                <h2 className="font-semibold text-accent">Profile</h2>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>

            {editingProfile ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input" value={profileForm.email}
                    onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Role</span>
                  <p className="font-medium mt-0.5 capitalize text-sm">{user?.role?.replace(/_/g, ' ').toLowerCase()}</p>
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-border">
                  <button type="button" className="btn-outline"
                    onClick={() => { setEditingProfile(false); setProfileForm({ full_name: user?.full_name || '', email: user?.email || '' }); }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={profileLoading} className="btn-primary">
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div><span className="text-gray-500">Full Name</span><p className="font-medium mt-0.5">{user?.full_name}</p></div>
                <div><span className="text-gray-500">Email</span><p className="font-medium mt-0.5">{user?.email}</p></div>
                <div><span className="text-gray-500">Role</span><p className="font-medium mt-0.5 capitalize">{user?.role?.replace(/_/g, ' ').toLowerCase()}</p></div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <KeyRound size={18} className="text-accent" />
              <h2 className="font-semibold text-accent">Change Password</h2>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required minLength={8} />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={pwLoading} className="btn-primary">
                  {pwLoading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* ── EXPENSE CATEGORIES TAB ── */}
      {tab === 'categories' && isAdmin && (
        <div className="card max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <Tag size={18} className="text-accent" />
            <div>
              <h2 className="font-semibold text-accent">Expense Categories</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage the categories available when recording manual expenses</p>
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {(expCats as any[]).map((cat: any) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
                <span className="text-sm font-medium">{cat.name}</span>
                <button onClick={() => delCat.mutate(cat.id)} className="p-1 text-danger hover:text-red-700 rounded" title="Delete category">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(expCats as any[]).length === 0 && <p className="text-muted-foreground text-sm py-2">No categories yet.</p>}
          </div>
          <form onSubmit={e => { e.preventDefault(); if (newCatName.trim()) addCat.mutate(newCatName.trim()); }} className="flex gap-2">
            <input className="input flex-1" placeholder="New category name..." value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <button type="submit" className="btn-primary flex items-center gap-1" disabled={addCat.isPending || !newCatName.trim()}>
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      )}

      {/* ── COMPANY PROFILE TAB ── */}
      {tab === 'company' && isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 size={18} className="text-accent" />
              <div>
                <h2 className="font-semibold text-accent">Company Profile</h2>
                <p className="text-xs text-muted-foreground mt-0.5">These details appear on all printed proforma invoices and payslips</p>
              </div>
            </div>
            {!editingCompany && (
              <button onClick={() => setEditingCompany(true)}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>

          {editingCompany ? (
            <form onSubmit={e => { e.preventDefault(); updateCompany.mutate(companyForm); }} className="space-y-5">

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal & Tax</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">TIN Number <span className="text-primary">*</span></label>
                    <input className="input" value={companyForm.tin} onChange={cf('tin')} required />
                  </div>
                  <div>
                    <label className="label">Physical Address</label>
                    <input className="input" value={companyForm.address} onChange={cf('address')} placeholder="e.g. Muhanga, Shyogwe, Ruli, Rwanda" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Banking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Bank Name <span className="text-primary">*</span></label>
                    <input className="input" value={companyForm.bank_name} onChange={cf('bank_name')} required />
                  </div>
                  <div>
                    <label className="label">Account Number <span className="text-primary">*</span></label>
                    <input className="input" value={companyForm.bank_account} onChange={cf('bank_account')} required />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={companyForm.phone} onChange={cf('phone')} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={companyForm.email} onChange={cf('email')} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Signatory</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Director / Authorized Name <span className="text-primary">*</span></label>
                    <input className="input" value={companyForm.director_name} onChange={cf('director_name')} required />
                  </div>
                  <div>
                    <label className="label">Title</label>
                    <input className="input" value={companyForm.director_title} onChange={cf('director_title')} placeholder="e.g. Managing Director" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Default Terms (pre-filled on every new proforma)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Default Delivery Period</label>
                    <input className="input" value={companyForm.default_delivery_period} onChange={cf('default_delivery_period')}
                      placeholder="e.g. 45 days from receipt of advance payment" />
                  </div>
                  <div>
                    <label className="label">Default Payment Terms</label>
                    <textarea className="input resize-none" rows={2} value={companyForm.default_payment_terms} onChange={cf('default_payment_terms')}
                      placeholder="e.g. 50% advance, 25% upon completion of 75% of the order, and the remaining 25% before final delivery" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Invoice Alerts</h3>
                <div>
                  <label className="label">Overdue Grace Days <span className="text-xs text-muted-foreground">invoices don't flag as overdue until this many days past their due date</span></label>
                  <input type="number" min={0} className="input w-32" value={companyForm.overdue_grace_days}
                    onChange={e => setCompanyForm(f => ({ ...f, overdue_grace_days: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-border">
                <button type="button" className="btn-outline" onClick={() => { setEditingCompany(false); if (companyData) setCompanyForm({ ...companyData }); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={updateCompany.isPending}>
                  <Save size={14} /> {updateCompany.isPending ? 'Saving...' : 'Save Company Settings'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5 text-sm">
              <Section label="Legal & Tax">
                <Row k="TIN" v={companyData?.tin} />
                <Row k="Address" v={companyData?.address} />
              </Section>
              <Section label="Banking">
                <Row k="Bank" v={companyData?.bank_name} />
                <Row k="Account No." v={companyData?.bank_account} />
              </Section>
              <Section label="Contact">
                <Row k="Phone" v={companyData?.phone} />
                <Row k="Email" v={companyData?.email} />
              </Section>
              <Section label="Signatory">
                <Row k="Name" v={companyData?.director_name} />
                <Row k="Title" v={companyData?.director_title} />
              </Section>
              <Section label="Default Terms">
                <Row k="Delivery" v={companyData?.default_delivery_period} />
                <Row k="Payment" v={companyData?.default_payment_terms} />
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="grid grid-cols-1 gap-2 pl-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-28 shrink-0">{k}</span>
      <span className="font-medium text-foreground">{v || <span className="text-muted-foreground italic">Not set</span>}</span>
    </div>
  );
}
