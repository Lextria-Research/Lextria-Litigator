// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { TodayView } from './features/today/TodayView';
import { CalendarView } from './features/calendar/CalendarView';
import { CasesListView } from './features/cases/CasesListView';
import { CaseDetailView } from './features/cases/CaseDetailView';
import { DailyCauseListView } from './features/causeList/DailyCauseListView';
import { AgreementsKanbanView } from './features/agreements/AgreementsKanbanView';
import { AgreementDetailView } from './features/agreements/AgreementDetailView';
import { RenewalsView } from './features/agreements/RenewalsView';
import { TemplatesView } from './features/templates/TemplatesView';
import { DeadlinesView } from './features/deadlines/DeadlinesView';
import { IntegrationsView } from './features/admin/IntegrationsView';
import { LoginView } from './features/auth/LoginView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 mins
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<TodayView />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="cases" element={<CasesListView />} />
            <Route path="cases/:id" element={<CaseDetailView />} />
            <Route path="cause-list" element={<DailyCauseListView />} />
            <Route path="agreements" element={<AgreementsKanbanView />} />
            <Route path="agreements/:id" element={<AgreementDetailView />} />
            <Route path="renewals" element={<RenewalsView />} />
            <Route path="templates" element={<TemplatesView />} />
            <Route path="deadlines" element={<DeadlinesView />} />
            <Route path="admin/integrations" element={<IntegrationsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
