import { Route } from 'react-router-dom';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export const adminRoutes = (
  <Route path="admin" element={<AdminDashboardPage />} />
);
