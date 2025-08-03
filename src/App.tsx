import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import { Auth } from "./pages/Auth";
import Campaigns from "./pages/Campaigns";
import EditCampaign from "./pages/EditCampaign";
import CreateCampaign from "./pages/CreateCampaign";
import Answers from "./pages/Answers";
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
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/campaigns" 
            element={
              <ProtectedRoute>
                <Campaigns />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/campaigns/new" 
            element={
              <ProtectedRoute>
                <CreateCampaign />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/campaigns/edit/:id" 
            element={
              <ProtectedRoute>
                <EditCampaign />
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
