import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, DollarSign, Factory, Package,
  ShoppingCart, FileText, FileCheck, Truck, TrendingUp, BarChart2,
  PanelLeftClose, PanelLeftOpen, UserCheck, ClipboardList, ShieldCheck, Settings,
  Flame, Building, Tag, ClipboardCheck, Upload, History, ChevronDown, Pin, PinOff,
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

const ALL_ITEMS: NavItem[] = GROUPS.flatMap(group => group.items);
const PINNED_ROUTES_KEY = 'optima-clays-pinned-nav';
const MAX_PINNED = 6;

function loadPinnedRoutes(): string[] {
  try {
    const raw = window.localStorage.getItem(PINNED_ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [pinnedRoutes, setPinnedRoutes] = useState<string[]>(() => loadPinnedRoutes());
  const { user } = useAuth();
  const location = useLocation();

  const role = user?.role ?? '';

  useEffect(() => {
    window.localStorage.setItem(PINNED_ROUTES_KEY, JSON.stringify(pinnedRoutes));
  }, [pinnedRoutes]);

  function visibleItems(items: NavItem[]) {
    return items.filter(item => !item.roles || item.roles.includes(role));
  }

  function togglePin(to: string) {
    setPinnedRoutes(prev => {
      if (prev.includes(to)) return prev.filter(route => route !== to);
      if (prev.length >= MAX_PINNED) return prev;
      return [...prev, to];
    });
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

  const visiblePinnedItems = pinnedRoutes
    .map(to => ALL_ITEMS.find(item => item.to === to))
    .filter((item): item is NavItem => !!item && (!item.roles || item.roles.includes(role)));

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col bg-brand-navy text-white h-full flex-shrink-0"
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-3.5 py-3.5 border-b border-white/10 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="OPTIMA CLAYS LTD"
          className={`object-contain flex-shrink-0 ${collapsed ? 'h-7 w-7' : 'h-9 w-auto max-w-[110px]'}`}
        />
        {!collapsed && (
          <div>
            <div className="font-bold text-[13px] leading-tight tracking-tight">OPTIMA CLAYS</div>
            <div className="text-[11px] text-white/50">Business System</div>
          </div>
        )}
      </div>

      {/* Pinned shortcuts */}
      {!collapsed && visiblePinnedItems.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-white/10 flex-shrink-0">
          {visiblePinnedItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                `group relative flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white'
                }`
              }
            >
              <Icon size={15} />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(to); }}
                title={`Unpin ${label}`}
                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-brand-navy border border-white/30 text-white/70 hover:text-white"
              >
                <PinOff size={9} />
              </button>
            </NavLink>
          ))}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2 px-1.5 overflow-y-auto space-y-0">
        {GROUPS.map(group => {
          const items = visibleItems(group.items);
          if (items.length === 0) return null;

          const isCollapsible = !collapsed && group.label !== '';
          const isClosed = isGroupClosed(group.label);
          const hasActive = groupHasActive(items);

          return (
            <div key={group.label || 'root'} className="mb-0.5">
              {/* Group header */}
              {group.label !== '' && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-2.5 py-1 mt-2.5 rounded text-left transition-colors group ${
                    hasActive && isClosed ? 'text-white/90' : 'text-white/35 hover:text-white/65'
                  }`}
                >
                  <span className="text-[9.5px] font-semibold uppercase tracking-widest">
                    {group.label}
                    {hasActive && isClosed && (
                      <span className="ml-1.5 inline-block w-1 h-1 rounded-full bg-primary align-middle" />
                    )}
                  </span>
                  <ChevronDown
                    size={10}
                    className={`transition-transform duration-150 ${isClosed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Items */}
              {(!isCollapsible || !isClosed) && (
                <div className={group.label && !collapsed ? 'mt-0.5' : ''}>
                  {items.map(({ to, icon: Icon, label }) => {
                    const isPinned = pinnedRoutes.includes(to);
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-md text-[13px] font-medium transition-colors hover:bg-white/10 ${
                            isActive ? 'bg-primary/90 text-white' : 'text-white/65'
                          } ${collapsed ? 'justify-center' : ''}`
                        }
                        title={collapsed ? label : undefined}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && !collapsed && (
                              <motion.span
                                layoutId="sidebar-active-pill"
                                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-white/80"
                                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                              />
                            )}
                            <Icon size={16} className="flex-shrink-0" />
                            {!collapsed && <span className="flex-1 truncate">{label}</span>}
                            {!collapsed && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(to); }}
                                title={isPinned ? `Unpin ${label}` : `Pin ${label}`}
                                className={`flex-shrink-0 ${isPinned ? 'text-white/70' : 'text-white/0 group-hover:text-white/40 hover:!text-white'}`}
                              >
                                <Pin size={11} fill={isPinned ? 'currentColor' : 'none'} />
                              </button>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
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
    </motion.aside>
  );
}
