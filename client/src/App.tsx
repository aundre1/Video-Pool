import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Browse from "@/pages/browse";
import Video from "@/pages/video";
import Membership from "@/pages/membership";
import Dashboard from "@/pages/dashboard";
import Support from "@/pages/support";
import MixExport from "@/pages/mix-export";
import AdminIndex from "@/pages/admin/index";
import AdminVideos from "@/pages/admin/videos";
import AdminUsers from "@/pages/admin/users";
import AdminEmail from "@/pages/admin/email";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "./hooks/use-auth";

function Router() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/browse" component={Browse} />
      <Route path="/video/:id" component={Video} />
      <Route path="/membership" component={Membership} />
      <Route path="/support" component={Support} />
      
      {/* Protected routes */}
      {isAuthenticated && (
        <>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/mix-export" component={MixExport} />
        </>
      )}
      
      {/* Admin routes */}
      {isAdmin && (
        <>
          <Route path="/admin" component={AdminIndex} />
          <Route path="/admin/videos" component={AdminVideos} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/email" component={AdminEmail} />
        </>
      )}
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Header />
        <main className="min-h-screen bg-background">
          <Router />
        </main>
        <Footer />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
