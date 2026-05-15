import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/auth/AuthProvider';
import { WorkspaceProvider } from './hooks/useWorkspace';
import SetupRequired from './components/auth/SetupRequired';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import AskKaeo from './pages/AskKaeo';
import Files from './pages/Files';
import Transactions from './pages/Transactions';
import Vendors from './pages/Vendors';
import RiskInbox from './pages/RiskInbox';
import Reports from './pages/Reports';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LoadingState from './components/ui/LoadingState';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isConfigured, error } = useAuth();

  if (!isConfigured) {
    return <SetupRequired />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 p-4 bg-risk/10 text-risk border border-risk/20 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="ask-kaeo" element={<AskKaeo />} />
              <Route path="files" element={<Files />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="risk-inbox" element={<RiskInbox />} />
              <Route path="reports" element={<Reports />} />
              <Route path="clients" element={<Clients />} />
              <Route path="settings" element={<Settings />} />
              <Route path="billing" element={<Billing />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
