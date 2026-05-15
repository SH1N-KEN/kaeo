import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
