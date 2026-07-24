import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, DollarSign, Factory, Package,
  ShoppingCart, FileText, FileCheck, Truck, TrendingUp, BarChart2,
  PanelLeftClose, PanelLeftOpen, UserCheck, ClipboardList, ShieldCheck, Settings,
  Flame, Building, Tag, ClipboardCheck, Upload, History, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type NavItem = { to: string; icon: React.ElementType; label: string; roles: string[] | null };
type Group = { label: string; items: NavItem[] };

const GROUPS: Group[] = [
  {
    label: '',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: null },
    ],
  },
  {
    label: 'People & HR',
    items: [
      { to: '/employees',  icon: Users,     label: 'Employees',  roles: ['ADMIN', 'ACCOUNTANT'] },
      { to: '/attendance', icon: UserCheck,  label: 'Attendance', roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
      { to: '/payroll',    icon: DollarSign, label: 'Payroll',    roles: ['ADMIN', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'Production',
    items: [
      { to: '/production', icon: Factory, label: 'Production', roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
      { to: '/kilns',      icon: Flame,   label: 'Kilns',      roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory',      icon: Package,       label: 'Inventory',      roles: ['ADMIN', 'STORE_MANAGER', 'PRODUCTION_SUPERVISOR'] },
      { to: '/suppliers',      icon: Building,      label: 'Suppliers',      roles: ['ADMIN', 'STORE_MANAGER'] },
      { to: '/reconciliation', icon: ClipboardCheck, label: 'Reconciliation', roles: ['ADMIN', 'STORE_MANAGER'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/customers',      icon: ClipboardList, label: 'Customers',      roles: ['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT'] },
      { to: '/orders',         icon: ShoppingCart,  label: 'Orders',         roles: ['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT'] },
      { to: '/price-catalogue',icon: Tag,           label: 'Price Catalogue',roles: ['ADMIN', 'SALES_OFFICER'] },
      { to: '/invoices',       icon: FileText,      label: 'Invoices',       roles: ['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT'] },
      { to: '/proformas',      icon: FileCheck,     label: 'Proformas',      roles: ['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT'] },
      { to: '/deliveries',     icon: Truck,         label: 'Deliveries',     roles: ['ADMIN', 'SALES_OFFICER', 'STORE_MANAGER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/financials', icon: TrendingUp, label: 'Financials', roles: ['ADMIN', 'ACCOUNTANT'] },
      { to: '/reports',    icon: BarChart2,  label: 'Reports',    roles: ['ADMIN', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/import',   icon: Upload,     label: 'Bulk Import', roles: ['ADMIN'] },
      { to: '/audit',    icon: History,    label: 'Audit Log',   roles: ['ADMIN'] },
      { to: '/users',    icon: ShieldCheck,label: 'Users',       roles: ['ADMIN'] },
      { to: '/settings', icon: Settings,   label: 'Settings',    roles: null },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const location = useLocation();

  const role = user?.role ?? '';

  function visibleItems(items: NavItem[]) {
    return items.filter(item => !item.roles || item.roles.includes(role));
  }

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function isGroupClosed(label: string) {
    return openGroups[label] === true;
  }

  function groupHasActive(items: NavItem[]) {
    return items.some(item =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    );
  }

  return (
    <aside
      className={`relative flex flex-col bg-accent text-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'} h-full flex-shrink-0`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/10 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="OPTIMA CLAYS LTD"
          className={`object-contain flex-shrink-0 ${collapsed ? 'h-8 w-8' : 'h-10 w-auto max-w-[120px]'}`}
        />
        {!collapsed && (
          <div>
            <div className="font-bold text-sm leading-tight">OPTIMA CLAYS</div>
            <div className="text-xs text-white/60">Business System</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
        {GROUPS.map(group => {
          const items = visibleItems(group.items);
          if (items.length === 0) return null;

          const isCollapsible = !collapsed && group.label !== '';
          const isClosed = isGroupClosed(group.label);
          const hasActive = groupHasActive(items);

          return (
            <div key={group.label || 'root'} className="mb-1">
              {/* Group header */}
              {group.label !== '' && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 mt-2 rounded text-left transition-colors group ${
                    hasActive && isClosed ? 'text-white/90' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {group.label}
                    {hasActive && isClosed && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                    )}
                  </span>
                  <ChevronDown
                    size={11}
                    className={`transition-transform duration-150 ${isClosed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Items */}
              {(!isCollapsible || !isClosed) && (
                <div className={group.label && !collapsed ? 'mt-0.5' : ''}>
                  {items.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10 ${
                          isActive ? 'bg-primary text-white' : 'text-white/70'
                        } ${collapsed ? 'justify-center' : ''}`
                      }
                      title={collapsed ? label : undefined}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3.5 top-6 z-20 flex items-center justify-center w-7 h-7 bg-surface border border-border rounded-full shadow-md text-muted-foreground hover:text-accent hover:border-accent transition-all duration-150"
      >
        {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
      </button>
    </aside>
  );
}
