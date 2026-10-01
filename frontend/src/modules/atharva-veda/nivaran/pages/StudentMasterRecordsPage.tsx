import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { MyStudentRecordPage } from './MyStudentRecordPage';
import { StudentRecordSearchPage } from './StudentRecordSearchPage';

export const StudentMasterRecordsPage: React.FC = () => {
  const { isApplicant, isAuthority, isDean, isAssociateDean, isAssistantDean, isManager, isAdmin } = useAuth();

  if (isApplicant) {
    return <MyStudentRecordPage />;
  }

  if (isAuthority || isDean || isAssociateDean || isAssistantDean || isManager) {
    return <StudentRecordSearchPage />;
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/" replace />;
};
