import { Route } from 'react-router-dom';
import {
  NivaranWorkspacePage,
  GrievanceSubmitPage,
  ApplicantGrievanceListPage,
  ApplicantGrievanceDetailPage,
  ManagerTriageQueuePage,
  ManagerGrievanceReviewPage,
  AssistantDeanDashboardPage,
  AssistantDeanGrievanceDetailPage,
  ManagerClosureQueuePage,
  MyStudentRecordPage,
  StudentRecordSearchPage,
} from './pages';

export const atharvaVedaRoutes = (
  <>
    <Route path="atharva-veda/nivaran" element={<NivaranWorkspacePage />} />
    <Route path="atharva-veda/nivaran/submit" element={<GrievanceSubmitPage />} />
    <Route path="atharva-veda/nivaran/my-grievances" element={<ApplicantGrievanceListPage />} />
    <Route path="atharva-veda/nivaran/grievance/:id" element={<ApplicantGrievanceDetailPage />} />
    <Route path="atharva-veda/nivaran/manager/queue" element={<ManagerTriageQueuePage />} />
    <Route path="atharva-veda/nivaran/manager/closure-queue" element={<ManagerClosureQueuePage />} />
    <Route path="atharva-veda/nivaran/manager/review/:id" element={<ManagerGrievanceReviewPage />} />

    {/* Student Master Record Routes */}
    <Route path="atharva-veda/nivaran/student-records/me" element={<MyStudentRecordPage />} />
    <Route path="atharva-veda/nivaran/student-records/search" element={<StudentRecordSearchPage />} />

    {/* Assistant Dean Workflow Routes */}
    <Route path="atharva-veda/nivaran/assistant-dean/dashboard" element={<AssistantDeanDashboardPage />} />
    <Route path="atharva-veda/nivaran/assistant-dean/cases" element={<AssistantDeanDashboardPage />} />
    <Route path="atharva-veda/nivaran/assistant-dean/grievance/:id" element={<AssistantDeanGrievanceDetailPage />} />
    <Route path="atharva-veda/nivaran/assistant-dean/grievances/:id" element={<AssistantDeanGrievanceDetailPage />} />

    {/* Legacy alias routes */}
    <Route path="nivaran" element={<NivaranWorkspacePage />} />
    <Route path="nivaran/submit" element={<GrievanceSubmitPage />} />
    <Route path="nivaran/my-grievances" element={<ApplicantGrievanceListPage />} />
    <Route path="nivaran/grievance/:id" element={<ApplicantGrievanceDetailPage />} />
    <Route path="nivaran/manager/queue" element={<ManagerTriageQueuePage />} />
    <Route path="nivaran/manager/closure-queue" element={<ManagerClosureQueuePage />} />
    <Route path="nivaran/manager/review/:id" element={<ManagerGrievanceReviewPage />} />
    <Route path="nivaran/student-records/me" element={<MyStudentRecordPage />} />
    <Route path="nivaran/student-records/search" element={<StudentRecordSearchPage />} />
    <Route path="nivaran/assistant-dean/dashboard" element={<AssistantDeanDashboardPage />} />
    <Route path="nivaran/assistant-dean/cases" element={<AssistantDeanDashboardPage />} />
    <Route path="nivaran/assistant-dean/grievance/:id" element={<AssistantDeanGrievanceDetailPage />} />
    <Route path="nivaran/assistant-dean/grievances/:id" element={<AssistantDeanGrievanceDetailPage />} />
  </>
);

