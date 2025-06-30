import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sparkles, TrendingUp, Clock, ThumbsUp } from "lucide-react";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface VideoRecommendationsProps {
  videoId: number;
  categoryId?: number;
}

export default function VideoRecommendations({
  videoId,
  categoryId,
}: VideoRecommendationsProps) {
  const [activeTab, setActiveTab] = useState("similar");
  const { user } = useAuth();

  // Fetch similar videos (AI-driven similarity)
  const { data: similarVideos, isLoading: loadingSimilar } = useQuery({
    queryKey: ["/api/recommendations/similar", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations/similar/${videoId}`);
      if (!response.ok) throw new Error("Failed to fetch similar videos");
      return response.json();
    },
  });

  // Fetch "You might also like" recommendations
  const { data: youMightLikeVideos, isLoading: loadingYouMightLike } = useQuery({
    queryKey: ["/api/recommendations/you-might-like", videoId, user?.id],
    queryFn: async () => {
      let url = `/api/recommendations/you-might-like?videoId=${videoId}`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
  });

  // Fetch trending videos
  const { data: trendingVideos, isLoading: loadingTrending } = useQuery({
    queryKey: ["/api/recommendations/trending"],
    queryFn: async () => {
      const response = await fetch("/api/recommendations/trending");
      if (!response.ok) throw new Error("Failed to fetch trending videos");
      return response.json();
    },
    enabled: activeTab === "trending",
  });

  // Fetch popular videos
  const { data: popularVideos, isLoading: loadingPopular } = useQuery({
    queryKey: ["/api/recommendations/popular"],
    queryFn: async () => {
      const response = await fetch("/api/recommendations/popular");
      if (!response.ok) throw new Error("Failed to fetch popular videos");
      return response.json();
    },
    enabled: activeTab === "popular",
  });

  // Get recommendations based on the active tab
  const getActiveRecommendations = () => {
    switch (activeTab) {
      case "similar":
        return { data: similarVideos, loading: loadingSimilar };
      case "you-might-like":
        return { data: youMightLikeVideos, loading: loadingYouMightLike };
      case "trending":
        return { data: trendingVideos, loading: loadingTrending };
      case "popular":
        return { data: popularVideos, loading: loadingPopular };
      default:
        return { data: similarVideos, loading: loadingSimilar };
    }
  };

  const { data: recommendations, loading } = getActiveRecommendations();

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Recommended Videos</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-dark-card">
          <TabsTrigger value="similar" className="data-[state=active]:bg-primary">
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">AI-powered</span> Similar
          </TabsTrigger>
          <TabsTrigger value="you-might-like" className="data-[state=active]:bg-secondary">
            <ThumbsUp className="w-4 h-4 mr-2" />
            You Might Like
          </TabsTrigger>
          <TabsTrigger value="trending" className="data-[state=active]:bg-amber-500">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="popular" className="data-[state=active]:bg-blue-500">
            <Clock className="w-4 h-4 mr-2" />
            Most Popular
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden bg-dark-card">
                <Skeleton className="w-full aspect-video" />
                <CardContent className="p-3">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : recommendations?.length ? (
            // Recommendations
            recommendations.map((video: any) => (
              <Link key={video.id} href={`/video/${video.id}`}>
                <a className="block h-full">
                  <Card className="overflow-hidden bg-dark-card border-dark-border hover:border-primary cursor-pointer transition-colors h-full">
                    <div className="relative">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                      />
                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                      </div>
                      {/* Premium badge */}
                      {video.isPremium && (
                        <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-secondary text-white text-xs px-2 py-1 rounded-full">
                          Premium
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium line-clamp-2 mb-1">{video.title}</h3>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>{video.resolution}</span>
                        <span className="mx-1.5">•</span>
                        <span>{(video.downloadCount || 0).toLocaleString()} downloads</span>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No recommendations available. Try another category.
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}