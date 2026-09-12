import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { MainLayout } from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import KaryawanPage from './pages/KaryawanPage';
import AuditLogPage from './pages/AuditLogPage';
import ProfilePage from './pages/ProfilePage';
import MessSetupPage from './pages/MessSetupPage';
import MessDashboardPage from './pages/MessDashboardPage';
import MessMatrixPage from './pages/MessMatrixPage';
import MessTransferPage from './pages/MessTransferPage';
import { Toaster } from 'sonner';

// Lazy loaded assets routes
const VendorContractsPage = lazy(() => import('./pages/assets/VendorContractsPage'));
const UnitContractsPage   = lazy(() => import('./pages/assets/UnitContractsPage'));
const InvoicePage         = lazy(() => import('./pages/docs/InvoicePage'));
const InvoiceDetailPage   = lazy(() => import('./pages/docs/InvoiceDetailPage'));
const InvoiceDashboardPage= lazy(() => import('./pages/docs/InvoiceDashboardPage'));
const FinancePortal       = lazy(() => import('./pages/portal/FinancePortal'));
const TicketingPage       = lazy(() => import('./pages/transport/TicketingPage'));
const SopPage             = lazy(() => import('./pages/docs/SopPage'));
const CateringScoringPage = lazy(() => import('./pages/catering/CateringScoringPage'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LoadingProvider>
          <Toaster position="top-right" richColors />
          <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/finance-portal" element={<FinancePortal />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/mess/dashboard" element={<MessDashboardPage />} />
                <Route path="/mess/matrix" element={<MessMatrixPage />} />
                <Route path="/mess/setup" element={<MessSetupPage />} />
                <Route path="/mess/transfer" element={<MessTransferPage />} />
                <Route path="/karyawan" element={<KaryawanPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                
                {/* Travel & Transport */}
                <Route path="/transport" element={<Navigate to="/transport/ticketing" replace />} />
                <Route path="/transport/ticketing" element={<TicketingPage />} />

                {/* Assets */}
                <Route path="/assets/vendor" element={<VendorContractsPage />} />
                <Route path="/assets/unit" element={<UnitContractsPage />} />
                
                {/* Catering */}
                <Route path="/catering" element={<Navigate to="/catering/scoring" replace />} />
                <Route path="/catering/scoring" element={<CateringScoringPage />} />
                
                {/* Docs */}
                <Route path="/invoice/dashboard" element={<InvoiceDashboardPage />} />
                <Route path="/invoice" element={<InvoicePage />} />
                <Route path="/invoice/:id" element={<InvoiceDetailPage />} />
                <Route path="/docs" element={<Navigate to="/docs/standards" replace />} />
                <Route path="/docs/standards" element={<SopPage />} />
                
                {/* Catch-all for undefined routes inside layout */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </LoadingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
