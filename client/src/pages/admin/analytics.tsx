import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart2,
  Calendar,
  Download,
  Users,
  Eye,
  Star,
  ChevronUp,
  ChevronDown,
  Search,
  Clock,
  Filter,
} from "lucide-react";

export default function AdminAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState("30days");
  const [activeTab, setActiveTab] = useState("overview");

  // Redirect if not admin
  if (!user || user.role !== "admin") {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access the admin area",
      variant: "destructive",
    });
    return <Redirect to="/" />;
  }

  // Convert timeframe to actual date range for API
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case "7days":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90days":
        startDate.setDate(endDate.getDate() - 90);
        break;
      case "year":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['/api/admin/analytics/dashboard', timeframe],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const response = await fetch(
        `/api/admin/analytics/dashboard?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch analytics data');
      return response.json();
    },
  });

  // Fetch top content
  const { data: topContent, isLoading: isLoadingTopContent } = useQuery({
    queryKey: ['/api/admin/analytics/top-content', timeframe],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const response = await fetch(
        `/api/admin/analytics/top-content?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch top content data');
      return response.json();
    },
  });

  // Fetch category performance
  const { data: categoryData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/admin/analytics/categories', timeframe],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const response = await fetch(
        `/api/admin/analytics/categories?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch category data');
      return response.json();
    },
  });

  // Fetch user engagement
  const { data: engagementData, isLoading: isLoadingEngagement } = useQuery({
    queryKey: ['/api/admin/analytics/engagement', timeframe],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const response = await fetch(
        `/api/admin/analytics/engagement?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch engagement data');
      return response.json();
    },
  });

  // Helper function to format large numbers
  const formatNumber = (num: number) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
  };

  // Colors for charts
  const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <>
      <Helmet>
        <title>Content Analytics - VideoPool Pro</title>
        <meta name="description" content="Detailed analytics for video content usage" />
      </Helmet>

      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Content Analytics</h1>
            <p className="text-muted-foreground">
              Track video performance, user engagement, and revenue metrics
            </p>
          </div>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 md:w-[600px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content Performance</TabsTrigger>
            <TabsTrigger value="categories">Category Analysis</TabsTrigger>
            <TabsTrigger value="engagement">User Engagement</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        formatNumber(analyticsData?.totalDownloads || 0)
                      )}
                    </div>
                    <Download className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {!isLoading && analyticsData?.downloadGrowth && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className={analyticsData.downloadGrowth > 0 ? "text-green-500" : "text-red-500"}>
                        {analyticsData.downloadGrowth > 0 ? (
                          <ChevronUp className="inline h-3 w-3" />
                        ) : (
                          <ChevronDown className="inline h-3 w-3" />
                        )}
                        {Math.abs(analyticsData.downloadGrowth).toFixed(1)}%
                      </span>{" "}
                      from previous period
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Content Views</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        formatNumber(analyticsData?.totalViews || 0)
                      )}
                    </div>
                    <Eye className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {!isLoading && analyticsData?.viewGrowth && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className={analyticsData.viewGrowth > 0 ? "text-green-500" : "text-red-500"}>
                        {analyticsData.viewGrowth > 0 ? (
                          <ChevronUp className="inline h-3 w-3" />
                        ) : (
                          <ChevronDown className="inline h-3 w-3" />
                        )}
                        {Math.abs(analyticsData.viewGrowth).toFixed(1)}%
                      </span>{" "}
                      from previous period
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Content Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        formatNumber(analyticsData?.consumptionMinutes || 0) + " min"
                      )}
                    </div>
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {!isLoading && analyticsData?.consumptionGrowth && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className={analyticsData.consumptionGrowth > 0 ? "text-green-500" : "text-red-500"}>
                        {analyticsData.consumptionGrowth > 0 ? (
                          <ChevronUp className="inline h-3 w-3" />
                        ) : (
                          <ChevronDown className="inline h-3 w-3" />
                        )}
                        {Math.abs(analyticsData.consumptionGrowth).toFixed(1)}%
                      </span>{" "}
                      from previous period
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-dark-card border-dark-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {isLoading ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        formatNumber(analyticsData?.activeUsers || 0)
                      )}
                    </div>
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  {!isLoading && analyticsData?.userGrowth && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className={analyticsData.userGrowth > 0 ? "text-green-500" : "text-red-500"}>
                        {analyticsData.userGrowth > 0 ? (
                          <ChevronUp className="inline h-3 w-3" />
                        ) : (
                          <ChevronDown className="inline h-3 w-3" />
                        )}
                        {Math.abs(analyticsData.userGrowth).toFixed(1)}%
                      </span>{" "}
                      from previous period
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle>Download Trends</CardTitle>
                  <CardDescription>Downloads over time by content type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Skeleton className="h-full w-full" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analyticsData?.downloadTrends || []}
                          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="premium"
                            stackId="1"
                            stroke="#8B5CF6"
                            fill="#8B5CF6"
                            name="Premium"
                          />
                          <Area
                            type="monotone"
                            dataKey="standard"
                            stackId="1"
                            stroke="#EC4899"
                            fill="#EC4899"
                            name="Standard"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle>Content Popularity</CardTitle>
                  <CardDescription>Most popular content categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Skeleton className="h-full w-full" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData?.categoryDistribution || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {(analyticsData?.categoryDistribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [`${value} downloads`, name]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Performance Tab */}
          <TabsContent value="content">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>Top Performing Content</CardTitle>
                <CardDescription>Content with the most downloads and engagement</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTopContent ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-12 w-12 rounded" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-md border border-dark-border">
                      <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                          <thead className="border-b border-dark-border">
                            <tr className="border-b transition-colors hover:bg-dark-hover">
                              <th className="h-12 px-4 text-left align-middle font-medium">Title</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Category</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Downloads</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Views</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Conversion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(topContent?.videos || []).map((video: any) => (
                              <tr key={video.id} className="border-b transition-colors hover:bg-dark-hover">
                                <td className="p-4 align-middle">
                                  <div className="flex items-center gap-3">
                                    {video.thumbnailUrl && (
                                      <img
                                        src={video.thumbnailUrl}
                                        alt={video.title}
                                        className="h-10 w-16 rounded object-cover"
                                      />
                                    )}
                                    <div className="max-w-[200px] truncate font-medium">{video.title}</div>
                                  </div>
                                </td>
                                <td className="p-4 align-middle">{video.categoryName}</td>
                                <td className="p-4 align-middle">{formatNumber(video.downloads)}</td>
                                <td className="p-4 align-middle">{formatNumber(video.views)}</td>
                                <td className="p-4 align-middle">
                                  {video.downloads > 0 && video.views > 0
                                    ? `${((video.downloads / video.views) * 100).toFixed(1)}%`
                                    : "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>Content Popularity vs Duration</CardTitle>
                          <CardDescription>Correlation between content length and popularity</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart
                                margin={{
                                  top: 20,
                                  right: 20,
                                  bottom: 20,
                                  left: 20,
                                }}
                              >
                                <CartesianGrid />
                                <XAxis type="number" dataKey="duration" name="Duration (sec)" unit="s" />
                                <YAxis type="number" dataKey="downloads" name="Downloads" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Videos" data={topContent?.durationAnalysis || []} fill="#8884d8">
                                  {(topContent?.durationAnalysis || []).map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Scatter>
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>Content Download Trends</CardTitle>
                          <CardDescription>Top 5 videos download trends</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={topContent?.topVideosTrend || []}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {topContent?.topVideosIds?.map((videoId: number, index: number) => (
                                  <Line
                                    key={videoId}
                                    type="monotone"
                                    dataKey={`video${videoId}`}
                                    stroke={COLORS[index % COLORS.length]}
                                    name={topContent?.topVideosTitles?.[index] || `Video ${videoId}`}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Analysis Tab */}
          <TabsContent value="categories">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Performance metrics by content category</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCategories ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-md border border-dark-border">
                      <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                          <thead className="border-b border-dark-border">
                            <tr className="border-b transition-colors hover:bg-dark-hover">
                              <th className="h-12 px-4 text-left align-middle font-medium">Category</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Downloads</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Growth</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Avg. Time</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Popularity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(categoryData?.categories || []).map((category: any) => (
                              <tr key={category.id} className="border-b transition-colors hover:bg-dark-hover">
                                <td className="p-4 align-middle font-medium">{category.name}</td>
                                <td className="p-4 align-middle">{formatNumber(category.downloads)}</td>
                                <td className="p-4 align-middle">
                                  <span
                                    className={
                                      category.growthRate > 0 ? "text-green-500" : "text-red-500"
                                    }
                                  >
                                    {category.growthRate > 0 ? (
                                      <ChevronUp className="inline h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="inline h-4 w-4" />
                                    )}
                                    {Math.abs(category.growthRate).toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-4 align-middle">{category.avgTime.toFixed(1)} min</td>
                                <td className="p-4 align-middle">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-primary h-2 rounded-full" style={{ width: `${category.popularity}%` }} />
                                    <span>{category.popularity}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>Category Growth Comparison</CardTitle>
                          <CardDescription>Growth rate by category</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={categoryData?.categories || []}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="growthRate" name="Growth %" fill="#8B5CF6">
                                  {(categoryData?.categories || []).map((entry: any, index: number) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.growthRate > 0 ? "#10B981" : "#EF4444"}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>Category Download Distribution</CardTitle>
                          <CardDescription>Total downloads by category</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={categoryData?.categories || []}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="downloads" name="Downloads" fill="#EC4899" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Engagement Tab */}
          <TabsContent value="engagement">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>User Engagement Metrics</CardTitle>
                <CardDescription>How users interact with content</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEngagement ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Average Session Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {engagementData?.avgSessionTime.toFixed(1)} min
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span
                              className={
                                engagementData?.sessionTimeGrowth > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {engagementData?.sessionTimeGrowth > 0 ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}
                              {Math.abs(engagementData?.sessionTimeGrowth).toFixed(1)}%
                            </span>{" "}
                            from previous period
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Downloads Per User</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {engagementData?.downloadsPerUser.toFixed(1)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span
                              className={
                                engagementData?.downloadsPerUserGrowth > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {engagementData?.downloadsPerUserGrowth > 0 ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}
                              {Math.abs(engagementData?.downloadsPerUserGrowth).toFixed(1)}%
                            </span>{" "}
                            from previous period
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">View-to-Download</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {(engagementData?.viewToDownloadRate * 100).toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span
                              className={
                                engagementData?.conversionRateGrowth > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {engagementData?.conversionRateGrowth > 0 ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}
                              {Math.abs(engagementData?.conversionRateGrowth).toFixed(1)}%
                            </span>{" "}
                            from previous period
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {(engagementData?.returnRate * 100).toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span
                              className={
                                engagementData?.returnRateGrowth > 0
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {engagementData?.returnRateGrowth > 0 ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}
                              {Math.abs(engagementData?.returnRateGrowth).toFixed(1)}%
                            </span>{" "}
                            from previous period
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>User Activity by Time of Day</CardTitle>
                          <CardDescription>When users are most active</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={engagementData?.activityByTime || []}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hour" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="downloads" name="Downloads" fill="#8B5CF6" />
                                <Bar dataKey="views" name="Views" fill="#EC4899" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                          <CardTitle>Most Popular Search Terms</CardTitle>
                          <CardDescription>What users are searching for</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {(engagementData?.popularSearches || []).map((search: any, index: number) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Search className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{search.term}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="text-sm text-muted-foreground mr-4">
                                    {search.count} searches
                                  </span>
                                  <div className="w-24 h-2 bg-dark-card-accent rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary"
                                      style={{ width: `${search.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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

// Helper components for charts
const AreaChart = ({
  data,
  margin,
  children,
}: {
  data: any[];
  margin: { top: number; right: number; left: number; bottom: number };
  children: React.ReactNode;
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartAreaChart
        data={data}
        margin={margin}
      >
        {children}
      </RechartAreaChart>
    </ResponsiveContainer>
  );
};

const Area = ({ type, dataKey, stackId, stroke, fill, name }: any) => (
  <RechartArea
    type={type}
    dataKey={dataKey}
    stackId={stackId}
    stroke={stroke}
    fill={fill}
    name={name}
  />
);

const ScatterChart = ({
  margin,
  children,
}: {
  margin: { top: number; right: number; left: number; bottom: number };
  children: React.ReactNode;
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartScatterChart margin={margin}>
        {children}
      </RechartScatterChart>
    </ResponsiveContainer>
  );
};

const Scatter = ({ name, data, fill, children }: any) => (
  <RechartScatter name={name} data={data} fill={fill}>
    {children}
  </RechartScatter>
);

const RechartAreaChart = LineChart;
const RechartArea = Line;
const RechartScatterChart = LineChart;
const RechartScatter = Line;