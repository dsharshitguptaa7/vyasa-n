import { Route, Navigate } from 'react-router-dom';
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
  StudentMasterRecordsPage,
  CommitteesListPage,
  CommitteeWorkspacePage,
} from './pages';

export const atharvaVedaRoutes = (
  <>
    {/* Canonical Atharva Veda Routes */}
    <Route path="atharva-veda/workspace" element={<NivaranWorkspacePage />} />
    <Route path="atharva-veda/submit" element={<GrievanceSubmitPage />} />
    <Route path="atharva-veda/my-grievances" element={<ApplicantGrievanceListPage />} />
    <Route path="atharva-veda/grievance/:id" element={<ApplicantGrievanceDetailPage />} />
    <Route path="atharva-veda/manager/queue" element={<ManagerTriageQueuePage />} />
    <Route path="atharva-veda/manager/closure-queue" element={<ManagerClosureQueuePage />} />
    <Route path="atharva-veda/manager/review/:id" element={<ManagerGrievanceReviewPage />} />

    {/* Committee Management Routes */}
    <Route path="atharva-veda/committees" element={<CommitteesListPage />} />
    <Route path="atharva-veda/committees/:id" element={<CommitteeWorkspacePage />} />

    {/* Student Master Record Routes */}
    <Route path="atharva-veda/student-records" element={<StudentMasterRecordsPage />} />
    <Route path="atharva-veda/student-records/me" element={<MyStudentRecordPage />} />
    <Route path="atharva-veda/student-records/search" element={<Navigate to="/atharva-veda/student-records" replace />} />

    {/* Assistant Dean Workflow Routes */}
    <Route path="atharva-veda/assistant-dean/dashboard" element={<AssistantDeanDashboardPage />} />
    <Route path="atharva-veda/assistant-dean/cases" element={<AssistantDeanDashboardPage />} />
    <Route path="atharva-veda/assistant-dean/grievance/:id" element={<AssistantDeanGrievanceDetailPage />} />
    <Route path="atharva-veda/assistant-dean/grievances/:id" element={<AssistantDeanGrievanceDetailPage />} />

    {/* Legacy Atharva Veda aliases -> Redirects to Canonical */}
    <Route path="atharva-veda/nivaran" element={<Navigate to="/atharva-veda/workspace" replace />} />
    <Route path="atharva-veda/nivaran/submit" element={<Navigate to="/atharva-veda/submit" replace />} />
    <Route path="atharva-veda/nivaran/my-grievances" element={<Navigate to="/atharva-veda/my-grievances" replace />} />
    <Route path="atharva-veda/nivaran/manager/queue" element={<Navigate to="/atharva-veda/manager/queue" replace />} />
    <Route path="atharva-veda/nivaran/manager/closure-queue" element={<Navigate to="/atharva-veda/manager/closure-queue" replace />} />
    <Route path="atharva-veda/nivaran/committees" element={<Navigate to="/atharva-veda/committees" replace />} />
    <Route path="atharva-veda/nivaran/student-records" element={<Navigate to="/atharva-veda/student-records" replace />} />
    <Route path="atharva-veda/nivaran/student-records/me" element={<Navigate to="/atharva-veda/student-records/me" replace />} />
    <Route path="atharva-veda/nivaran/student-records/search" element={<Navigate to="/atharva-veda/student-records" replace />} />
    <Route path="atharva-veda/nivaran/assistant-dean/dashboard" element={<Navigate to="/atharva-veda/assistant-dean/dashboard" replace />} />
    <Route path="atharva-veda/nivaran/assistant-dean/cases" element={<Navigate to="/atharva-veda/assistant-dean/cases" replace />} />

    {/* Legacy nivaran aliases */}
    <Route path="nivaran" element={<Navigate to="/atharva-veda/workspace" replace />} />
    <Route path="nivaran/submit" element={<Navigate to="/atharva-veda/submit" replace />} />
    <Route path="nivaran/my-grievances" element={<Navigate to="/atharva-veda/my-grievances" replace />} />
    <Route path="nivaran/manager/queue" element={<Navigate to="/atharva-veda/manager/queue" replace />} />
    <Route path="nivaran/manager/closure-queue" element={<Navigate to="/atharva-veda/manager/closure-queue" replace />} />
    <Route path="nivaran/committees" element={<Navigate to="/atharva-veda/committees" replace />} />
    <Route path="nivaran/student-records/me" element={<Navigate to="/atharva-veda/student-records/me" replace />} />
    <Route path="nivaran/student-records/search" element={<Navigate to="/atharva-veda/student-records" replace />} />
    <Route path="nivaran/student-records" element={<Navigate to="/atharva-veda/student-records" replace />} />
    <Route path="nivaran/assistant-dean/dashboard" element={<Navigate to="/atharva-veda/assistant-dean/dashboard" replace />} />
    <Route path="nivaran/assistant-dean/cases" element={<Navigate to="/atharva-veda/assistant-dean/cases" replace />} />
    <Route path="nivaran/associate-dean/dashboard" element={<Navigate to="/atharva-veda/associate-dean/dashboard" replace />} />
    <Route path="nivaran/associate-dean/cases" element={<Navigate to="/atharva-veda/associate-dean/cases" replace />} />
    <Route path="nivaran/dean/dashboard" element={<Navigate to="/atharva-veda/dean/dashboard" replace />} />
    <Route path="nivaran/dean/cases" element={<Navigate to="/atharva-veda/dean/cases" replace />} />
  </>
);
