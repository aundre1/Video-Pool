import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Users, 
  Film, 
  Download, 
  TrendingUp, 
  Calendar, 
  Mail,
  BarChart2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

// Chart component for statistics visualization
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Line, LineChart } from "recharts";

// Admin dashboard overview component
export default function AdminIndex() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Redirect if not admin
  if (!user || user.role !== "admin") {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access the admin area",
      variant: "destructive",
    });
    return <Redirect to="/" />;
  }
  
  // Fetch admin dashboard statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/admin/statistics'],
  });
  
  // Sample data for charts
  const userStats = [
    { name: 'Jan', total: 120 },
    { name: 'Feb', total: 158 },
    { name: 'Mar', total: 205 },
    { name: 'Apr', total: 250 },
    { name: 'May', total: 320 },
    { name: 'Jun', total: 413 },
    { name: 'Jul', total: 520 },
  ];
  
  const downloadStats = [
    { name: 'Jan', premium: 420, free: 50 },
    { name: 'Feb', premium: 480, free: 65 },
    { name: 'Mar', premium: 553, free: 80 },
    { name: 'Apr', premium: 610, free: 95 },
    { name: 'May', premium: 690, free: 105 },
    { name: 'Jun', premium: 730, free: 120 },
    { name: 'Jul', premium: 820, free: 140 },
  ];
  
  // Helper function to format large numbers
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - VideoPool Pro</title>
        <meta name="description" content="Admin dashboard for VideoPool Pro" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage content, users, and monitor system statistics
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link href="/admin/videos/new">
              <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                <Film className="mr-2 h-4 w-4" /> Add New Video
              </Button>
            </Link>
          </div>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 md:w-[400px]">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          </TabsList>
          
          {/* Dashboard Overview Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : formatNumber(stats?.totalUsers || 0)}
                    </div>
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-green-500">+12.5%</span> from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : formatNumber(stats?.totalVideos || 0)}
                    </div>
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-green-500">+8.2%</span> from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Downloads Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : formatNumber(stats?.downloadsToday || 0)}
                    </div>
                    <Download className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-green-500">+5.1%</span> from yesterday
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Memberships</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : formatNumber(stats?.activeMemberships || 0)}
                    </div>
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-green-500">+15.3%</span> from last month
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle>User Growth</CardTitle>
                  <CardDescription>New user registrations over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "#252525", 
                            borderColor: "#333",
                            color: "#fff" 
                          }} 
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="hsl(var(--primary))" 
                          activeDot={{ r: 8 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle>Download Statistics</CardTitle>
                  <CardDescription>Monthly downloads by content type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={downloadStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "#252525", 
                            borderColor: "#333",
                            color: "#fff" 
                          }} 
                        />
                        <Legend />
                        <Bar dataKey="premium" fill="hsl(var(--primary))" name="Premium" />
                        <Bar dataKey="free" fill="hsl(var(--secondary))" name="Free" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Quick Actions Tab */}
          <TabsContent value="quick-actions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/admin/videos" className="block">
                <Card className="bg-dark-card border-dark-border h-full hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <Film className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Manage Videos</CardTitle>
                    <CardDescription>
                      Add, edit, or delete video content
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Organize your video library, upload new content, and manage content visibility.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/admin/users" className="block">
                <Card className="bg-dark-card border-dark-border h-full hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <Users className="h-8 w-8 text-secondary mb-2" />
                    <CardTitle>Manage Users</CardTitle>
                    <CardDescription>
                      View and manage user accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Review user accounts, manage memberships, and monitor download activity.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/admin/categories" className="block">
                <Card className="bg-dark-card border-dark-border h-full hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <Calendar className="h-8 w-8 text-amber-500 mb-2" />
                    <CardTitle>Manage Categories</CardTitle>
                    <CardDescription>
                      Organize your content categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Create, edit, and manage content categories to keep your library organized.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/admin/email" className="block">
                <Card className="bg-dark-card border-dark-border h-full hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <Mail className="h-8 w-8 text-purple-500 mb-2" />
                    <CardTitle>Email Marketing</CardTitle>
                    <CardDescription>
                      Send campaigns and newsletters
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Create and manage email campaigns, import subscribers, and use AI to generate content.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/admin/analytics" className="block">
                <Card className="bg-dark-card border-dark-border h-full hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <BarChart2 className="h-8 w-8 text-blue-500 mb-2" />
                    <CardTitle>Content Analytics</CardTitle>
                    <CardDescription>
                      Track content usage and performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Monitor video downloads, engagement metrics, and identify top-performing content.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>
          
          {/* Recent Activity Tab */}
          <TabsContent value="recent">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system events and user actions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-dark-border">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center 
                          ${i % 3 === 0 ? 'bg-primary/20' : i % 3 === 1 ? 'bg-secondary/20' : 'bg-amber-500/20'}`}>
                          {i % 3 === 0 ? (
                            <Download className={`h-5 w-5 text-primary`} />
                          ) : i % 3 === 1 ? (
                            <Users className={`h-5 w-5 text-secondary`} />
                          ) : (
                            <Film className={`h-5 w-5 text-amber-500`} />
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium">
                            {i % 3 === 0 ? 'New download' : i % 3 === 1 ? 'New user registration' : 'Video uploaded'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(Date.now() - i * 1000 * 60 * 30).toLocaleTimeString()} - 
                            {i % 3 === 0 ? ' User downloaded video #1234' : 
                             i % 3 === 1 ? ' New user registered: user123' : 
                             ' Admin uploaded "Cool DJ Visuals"'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
