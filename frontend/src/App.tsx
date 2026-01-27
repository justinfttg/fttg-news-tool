import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginForm } from './components/auth/LoginForm';
import { Layout } from './components/shared/Layout';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { NewsLibraryPage } from './pages/NewsLibraryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginForm />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/project/:id/calendar" element={<ProjectDetailPage />} />
                <Route path="/project/:id/library" element={<NewsLibraryPage />} />
                <Route path="/settings" element={<div>Settings (Phase 7)</div>} />
                <Route path="/admin" element={<div>Admin (Future)</div>} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
