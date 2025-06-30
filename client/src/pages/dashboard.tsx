import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { Download, Calendar, Clock, ArrowRight, BarChart3, Film } from "lucide-react";
import { formatDistance, format } from "date-fns";
import { VideoCard } from "@/components/ui/video-card";
import { User, Download as DownloadType, Video } from "@shared/schema";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();
  
  // Check if user is authenticated and has membership
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md bg-dark-card border-dark-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Sign In
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Membership information
  const { data: membership } = useQuery({
    queryKey: [`/api/memberships/${user.membershipId}`],
    enabled: !!user.membershipId,
  });

  // Download history
  const { data: downloads, isLoading: isLoadingDownloads } = useQuery<DownloadType[]>({
    queryKey: ['/api/user/downloads'],
  });

  // Recent downloads
  const { data: recentDownloads } = useQuery<(DownloadType & { video: Video })[]>({
    queryKey: ['/api/user/downloads/recent'],
  });

  // Recommended videos based on user's download history
  const { data: recommendedVideos, isLoading: isLoadingRecommendations } = useQuery<Video[]>({
    queryKey: ['/api/recommendations/personalized'],
    // Only fetch recommendations if user is authenticated
    enabled: !!user,
  });

  // Calculate download usage
  const downloadLimit = membership?.downloadLimit || 0;
  const downloadsUsed = user.downloadsUsed || 0;
  const downloadsRemaining = user.downloadsRemaining || 0;
  const downloadPercentage = downloadLimit > 0 ? Math.round((downloadsUsed / downloadLimit) * 100) : 0;

  // Calculate days remaining in membership
  const membershipEndDate = user.membershipEndDate ? new Date(user.membershipEndDate) : null;
  const daysRemaining = membershipEndDate ? 
    Math.ceil((membershipEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <>
      <Helmet>
        <title>Dashboard - VideoPool Pro</title>
        <meta name="description" content="Manage your downloads, view your membership details, and access your favorite videos." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user.username}
            </p>
          </div>
          
          {!user.membershipId && (
            <Link href="/membership">
              <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Upgrade to Premium
              </Button>
            </Link>
          )}
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 md:w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="downloads">Downloads</TabsTrigger>
            <TabsTrigger value="recommended">Recommended</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Membership Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle className="text-lg">Membership Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.membershipId ? (
                    <>
                      <div className="text-2xl font-bold">{membership?.name || "Active"}</div>
                      <p className="text-muted-foreground mt-1">
                        {membershipEndDate ? (
                          <>Renews {format(membershipEndDate, "MMM d, yyyy")} ({daysRemaining} days)</>
                        ) : (
                          "Active membership"
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">Free Account</div>
                      <p className="text-muted-foreground mt-1">
                        Limited access to content
                      </p>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  {user.membershipId ? (
                    <Link href="/dashboard/billing">
                      <Button variant="outline" size="sm">Manage Billing</Button>
                    </Link>
                  ) : (
                    <Link href="/membership">
                      <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90" size="sm">
                        Upgrade Now
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle className="text-lg">Downloads</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.membershipId ? (
                    <>
                      <div className="flex justify-between mb-2">
                        <span className="text-2xl font-bold">{downloadsRemaining}</span>
                        <span className="text-muted-foreground">of {downloadLimit}</span>
                      </div>
                      <Progress value={downloadPercentage} className="h-2" />
                      <p className="text-muted-foreground mt-2">Downloads remaining this cycle</p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">Limited</div>
                      <p className="text-muted-foreground mt-1">
                        Only free content available
                      </p>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Link href="/browse">
                    <Button variant="outline" size="sm">Browse Content</Button>
                  </Link>
                </CardFooter>
              </Card>
              
              <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{downloads?.length || 0}</div>
                  <p className="text-muted-foreground mt-1">
                    Total downloads
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("downloads")}>
                    View History
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            {/* Recent Downloads */}
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Recent Downloads</CardTitle>
                  <Button variant="link" size="sm" className="text-primary" onClick={() => setActiveTab("downloads")}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDownloads ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : recentDownloads && recentDownloads.length > 0 ? (
                  <div className="space-y-4">
                    {recentDownloads.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded bg-dark-lighter overflow-hidden flex-shrink-0">
                          {item.video?.thumbnailUrl && (
                            <img 
                              src={item.video.thumbnailUrl} 
                              alt={item.video.title} 
                              className="w-full h-full object-cover" 
                            />
                          )}
                        </div>
                        <div className="flex-grow overflow-hidden">
                          <p className="font-medium truncate">{item.video?.title || "Untitled Video"}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.downloadedAt ? formatDistance(new Date(item.downloadedAt), new Date(), { addSuffix: true }) : "Recently"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Download className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No downloads yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start exploring our library and download your first video
                    </p>
                    <Link href="/browse">
                      <Button>Browse Content</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Downloads Tab */}
          <TabsContent value="downloads">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>Download History</CardTitle>
                <CardDescription>
                  View all your downloaded content
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDownloads ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : downloads && downloads.length > 0 ? (
                  <div className="space-y-4">
                    {downloads.map((download) => (
                      <div key={download.id} className="flex items-center justify-between p-4 border border-dark-border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Download className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Video #{download.videoId}</p>
                            <p className="text-sm text-muted-foreground">
                              {download.downloadedAt && (
                                format(new Date(download.downloadedAt), "MMM d, yyyy 'at' h:mm a")
                              )}
                            </p>
                          </div>
                        </div>
                        <Link href={`/video/${download.videoId}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Download className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No downloads yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start exploring our library and download your first video
                    </p>
                    <Link href="/browse">
                      <Button>Browse Content</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Recommended Tab */}
          <TabsContent value="recommended">
            <Card className="bg-dark-card border-dark-border">
              <CardHeader>
                <CardTitle>Recommended for You</CardTitle>
                <CardDescription>
                  Based on your download history and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRecommendations ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : recommendedVideos && recommendedVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recommendedVideos.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Film className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start downloading content to get personalized recommendations
                    </p>
                    <Link href="/browse">
                      <Button>Explore Content</Button>
                    </Link>
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
