import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/ui/video-card";
import { PlayerModal } from "@/components/ui/player-modal";
import { Video } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Play, Download, Clock, Calendar, BarChart, Tag, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function VideoPage() {
  const [match, params] = useRoute<{ id: string }>("/video/:id");
  const [showPreview, setShowPreview] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  
  const videoId = match ? parseInt(params.id) : 0;
  
  const { data: video, isLoading: isLoadingVideo } = useQuery<Video>({
    queryKey: [`/api/videos/${videoId}`],
    enabled: !!videoId,
  });
  
  const { data: relatedVideos, isLoading: isLoadingRelated } = useQuery<Video[]>({
    queryKey: [`/api/videos/related/${videoId}`],
    enabled: !!videoId,
  });
  
  const isLoading = isLoadingVideo || isLoadingRelated;
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  if (!video) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Video Not Found</h1>
          <p className="text-muted-foreground mb-6">The video you're looking for doesn't exist or has been removed.</p>
          <Link href="/browse">
            <Button>Browse Other Videos</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const handleDownload = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to download videos",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/videos/${video.id}/download`, {});
      
      toast({
        title: "Download Started",
        description: "Your video is being downloaded",
        variant: "default",
      });
      
      // Invalidate user data to refresh download counts
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Please check your membership status and download limits",
        variant: "destructive",
      });
    }
  };
  
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Fallback related videos
  const displayRelatedVideos = relatedVideos || [];

  return (
    <>
      <Helmet>
        <title>{video.title} - VideoPool Pro</title>
        <meta name="description" content={video.description} />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Video Preview */}
            <div className="relative rounded-xl overflow-hidden mb-6">
              <img 
                src={video.thumbnailUrl} 
                alt={video.title}
                className="w-full aspect-video object-cover" 
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button 
                  className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90"
                  onClick={() => setShowPreview(true)}
                >
                  <Play className="h-8 w-8" />
                </Button>
              </div>
              {video.isPremium && (
                <span className="absolute top-4 right-4 bg-primary/90 text-xs font-medium py-1 px-3 rounded text-white">
                  Premium
                </span>
              )}
            </div>
            
            {/* Video Details */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">{video.title}</h1>
              <p className="text-muted-foreground mb-6">{video.description}</p>
              
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-muted-foreground mr-2" />
                  <span>{formatDuration(video.duration)}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-muted-foreground mr-2" />
                  <span>Added {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center">
                  <BarChart className="h-5 w-5 text-muted-foreground mr-2" />
                  <span>{video.resolution}</span>
                </div>
                <div className="flex items-center">
                  <Tag className="h-5 w-5 text-muted-foreground mr-2" />
                  <span>{video.isLoop ? "Loop" : "Sequence"}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <Button 
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  onClick={handleDownload}
                >
                  <Download className="mr-2 h-5 w-5" /> Download
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                >
                  <Play className="mr-2 h-5 w-5" /> Preview
                </Button>
              </div>
            </div>
            
            {/* Features and Compatibility */}
            <div className="bg-dark-card rounded-xl p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">Features</h2>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Check className="text-green-500 mt-1 mr-3 h-5 w-5 flex-shrink-0" />
                  <span>High quality {video.resolution} resolution</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-500 mt-1 mr-3 h-5 w-5 flex-shrink-0" />
                  <span>Compatible with all major DJ software</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-500 mt-1 mr-3 h-5 w-5 flex-shrink-0" />
                  <span>{video.isLoop ? "Perfect seamless loop" : "Professionally crafted sequence"}</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-green-500 mt-1 mr-3 h-5 w-5 flex-shrink-0" />
                  <span>Commercial license included with membership</span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Sidebar / Related Videos */}
          <div>
            <h2 className="text-xl font-bold mb-4">Related Videos</h2>
            <div className="space-y-6">
              {displayRelatedVideos.map((relatedVideo) => (
                <VideoCard key={relatedVideo.id} video={relatedVideo} />
              ))}
              
              {displayRelatedVideos.length === 0 && (
                <p className="text-muted-foreground">No related videos found</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreview && (
        <PlayerModal 
          isOpen={showPreview} 
          onClose={() => setShowPreview(false)} 
          videoUrl={video.previewUrl || ""}
          title={video.title}
          description="Preview (30 seconds)"
        />
      )}
    </>
  );
}
