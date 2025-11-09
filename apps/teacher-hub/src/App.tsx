import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import Login from "./pages/Login";
import { Auth } from "./pages/Auth";
import Lessons from "./pages/Lessons";
import CreateLesson from "./pages/CreateLesson";
import EditLesson from "./pages/EditLesson";
import LessonPerformance from "./pages/LessonPerformance";
import Students from "./pages/Students";
import StudentPerformance from "./pages/StudentPerformance";
import Answers from "./pages/Answers";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route 
            path="/" 
            element={<Navigate to="/lessons" replace />} 
          />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/lessons" 
            element={
              <ProtectedRoute>
                <Lessons />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lessons/new" 
            element={
              <ProtectedRoute>
                <CreateLesson />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lessons/:id/performance" 
            element={
              <ProtectedRoute>
                <LessonPerformance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/lessons/edit/:id" 
            element={
              <ProtectedRoute>
                <EditLesson />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/students" 
            element={
              <ProtectedRoute>
                <Students />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/students/:id" 
            element={
              <ProtectedRoute>
                <StudentPerformance />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/answers" 
            element={
              <ProtectedRoute>
                <Answers />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
