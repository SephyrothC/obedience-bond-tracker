import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./components/Dashboard";
import Habits from "./pages/Habits";
import CreateHabit from "./pages/CreateHabit";
import Partnership from "./pages/Partnership";
import PartnerStats from "./pages/PartnerStats";
import Calendar from "./pages/Calendar";
import SharedTasks from "./pages/SharedTasks";
import Rewards from "./pages/Rewards";
import ManageRewards from "./pages/ManageRewards";
import Punishments from "./pages/Punishments";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/habits" 
              element={
                <ProtectedRoute>
                  <Habits />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/habits/create" 
              element={
                <ProtectedRoute>
                  <CreateHabit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partnership" 
              element={
                <ProtectedRoute>
                  <Partnership />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/partner-stats" 
              element={
                <ProtectedRoute>
                  <PartnerStats />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/calendar" 
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/shared-tasks" 
              element={
                <ProtectedRoute>
                  <SharedTasks />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rewards" 
              element={
                <ProtectedRoute>
                  <Rewards />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage-rewards" 
              element={
                <ProtectedRoute>
                  <ManageRewards />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/punishments" 
              element={
                <ProtectedRoute>
                  <Punishments />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
