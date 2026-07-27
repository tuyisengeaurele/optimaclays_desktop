import type { JSX } from 'react/jsx-runtime'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute, { RequireRole } from './components/layout/ProtectedRoute'
import Layout from './components/layout/Layout'
import IdleLockOverlay from './components/IdleLockOverlay'

import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import AttendancePage from './pages/AttendancePage'
import PayrollPage from './pages/PayrollPage'
import PayrollRunPage from './pages/PayrollRunPage'
import ProductionPage from './pages/ProductionPage'
import KilnsPage from './pages/KilnsPage'
import InventoryPage from './pages/InventoryPage'
import SuppliersPage from './pages/SuppliersPage'
import ReconciliationPage from './pages/ReconciliationPage'
import CustomersPage from './pages/CustomersPage'
import CustomerStatementPage from './pages/CustomerStatementPage'
import OrdersPage from './pages/OrdersPage'
import PriceCataloguePage from './pages/PriceCataloguePage'
import InvoicesPage from './pages/InvoicesPage'
import ProformasPage from './pages/ProformasPage'
import DeliveriesPage from './pages/DeliveriesPage'
import FinancialsPage from './pages/FinancialsPage'
import ReportsPage from './pages/ReportsPage'
import ImportPage from './pages/ImportPage'
import AuditLogPage from './pages/AuditLogPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App(): JSX.Element {
  return (
    <MotionConfig reducedMotion="user">
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <IdleLockOverlay />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />

              <Route
                path="employees"
                element={
                  <RequireRole roles={['ADMIN', 'ACCOUNTANT']}>
                    <EmployeesPage />
                  </RequireRole>
                }
              />
              <Route
                path="attendance"
                element={
                  <RequireRole roles={['ADMIN', 'PRODUCTION_SUPERVISOR', 'ACCOUNTANT']}>
                    <AttendancePage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll"
                element={
                  <RequireRole roles={['ADMIN', 'ACCOUNTANT']}>
                    <PayrollPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/:runId"
                element={
                  <RequireRole roles={['ADMIN', 'ACCOUNTANT']}>
                    <PayrollRunPage />
                  </RequireRole>
                }
              />

              <Route
                path="production"
                element={
                  <RequireRole roles={['ADMIN', 'PRODUCTION_SUPERVISOR']}>
                    <ProductionPage />
                  </RequireRole>
                }
              />
              <Route
                path="kilns"
                element={
                  <RequireRole roles={['ADMIN', 'PRODUCTION_SUPERVISOR']}>
                    <KilnsPage />
                  </RequireRole>
                }
              />
              <Route
                path="inventory"
                element={
                  <RequireRole roles={['ADMIN', 'STORE_MANAGER', 'PRODUCTION_SUPERVISOR']}>
                    <InventoryPage />
                  </RequireRole>
                }
              />
              <Route
                path="suppliers"
                element={
                  <RequireRole roles={['ADMIN', 'STORE_MANAGER']}>
                    <SuppliersPage />
                  </RequireRole>
                }
              />
              <Route
                path="reconciliation"
                element={
                  <RequireRole roles={['ADMIN', 'STORE_MANAGER']}>
                    <ReconciliationPage />
                  </RequireRole>
                }
              />

              <Route
                path="customers"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT']}>
                    <CustomersPage />
                  </RequireRole>
                }
              />
              <Route
                path="customers/:customerId/statement"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT']}>
                    <CustomerStatementPage />
                  </RequireRole>
                }
              />
              <Route
                path="orders"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT']}>
                    <OrdersPage />
                  </RequireRole>
                }
              />
              <Route
                path="price-catalogue"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER']}>
                    <PriceCataloguePage />
                  </RequireRole>
                }
              />
              <Route
                path="invoices"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT']}>
                    <InvoicesPage />
                  </RequireRole>
                }
              />
              <Route
                path="proformas"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'ACCOUNTANT']}>
                    <ProformasPage />
                  </RequireRole>
                }
              />
              <Route
                path="deliveries"
                element={
                  <RequireRole roles={['ADMIN', 'SALES_OFFICER', 'STORE_MANAGER']}>
                    <DeliveriesPage />
                  </RequireRole>
                }
              />

              <Route
                path="financials"
                element={
                  <RequireRole roles={['ADMIN', 'ACCOUNTANT']}>
                    <FinancialsPage />
                  </RequireRole>
                }
              />
              <Route
                path="reports"
                element={
                  <RequireRole roles={['ADMIN', 'ACCOUNTANT']}>
                    <ReportsPage />
                  </RequireRole>
                }
              />
              <Route
                path="import"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <ImportPage />
                  </RequireRole>
                }
              />
              <Route
                path="audit"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <AuditLogPage />
                  </RequireRole>
                }
              />

              <Route
                path="users"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <UsersPage />
                  </RequireRole>
                }
              />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
    </MotionConfig>
  )
}
