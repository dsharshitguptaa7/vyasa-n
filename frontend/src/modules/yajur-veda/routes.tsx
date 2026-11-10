import { Route } from 'react-router-dom';
import { YajurVedaDashboardPage } from './pages/YajurVedaDashboardPage';
import { AnudaanPortalPage } from './pages/AnudaanPortalPage';
import { AnudaanTrackingPage } from './pages/AnudaanTrackingPage';
import { AnudaanSanctionLetterPage } from './pages/AnudaanSanctionLetterPage';
import { AnudaanWizardPage } from './pages/AnudaanWizardPage';

export const yajurVedaRoutes = (
  <>
    <Route path="yajur-veda" element={<YajurVedaDashboardPage />} />
    <Route path="yajur-veda/anudaan" element={<AnudaanPortalPage />} />
    <Route path="yajur-veda/anudaan/apply" element={<AnudaanWizardPage />} />
    <Route path="yajur-veda/anudaan/track" element={<AnudaanTrackingPage />} />
    <Route path="yajur-veda/anudaan/sanction/:id" element={<AnudaanSanctionLetterPage />} />
  </>
);
