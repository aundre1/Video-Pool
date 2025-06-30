import { useState } from "react";
import { Link } from "wouter";
import { Play, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerModal } from "@/components/ui/player-modal";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface VideoCardProps {
  video: {
    id: number;
    title: string;
    description: string;
    thumbnailUrl: string;
    duration: number;
    resolution: string;
    isLoop: boolean | null;
    isPremium: boolean | null;
    isNew: boolean | null;
    createdAt: Date | null;
    videoUrl?: string;
    previewUrl?: string;
    downloadCount?: number | null;
    categoryId?: number;
  };
}

// Helper to format duration from seconds to MM:SS
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function VideoCard({ video }: VideoCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save videos",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Video Saved",
      description: "Video has been added to your favorites",
      variant: "default",
    });
  };

  return (
    <>
      <div className="bg-dark-card rounded-xl overflow-hidden group relative">
        <Link href={`/video/${video.id}`}>
          <div className="relative">
            <img 
              src={video.thumbnailUrl} 
              alt={video.title} 
              className="w-full aspect-video object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 p-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPreview(true);
                }}
              >
                <Play className="h-5 w-5" />
              </Button>
              <div className="ml-auto flex space-x-2">
                <Button 
                  size="icon"
                  className="w-10 h-10 rounded-full bg-dark-lighter/80 text-white flex items-center justify-center hover:bg-dark-lighter p-0"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon"
                  className="w-10 h-10 rounded-full bg-dark-lighter/80 text-white flex items-center justify-center hover:bg-dark-lighter p-0"
                  onClick={handleSave}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {video.isPremium && (
              <span className="absolute top-3 right-3 bg-primary/90 text-xs font-medium py-1 px-2 rounded text-white">
                Premium
              </span>
            )}
            {video.isNew && (
              <span className="absolute top-3 right-3 bg-secondary/90 text-xs font-medium py-1 px-2 rounded text-white">
                New
              </span>
            )}
            <span className="absolute bottom-3 right-3 bg-dark-lighter/90 text-xs font-medium py-1 px-2 rounded text-white">
              {formatDuration(video.duration)}
            </span>
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg mb-1">{video.title}</h3>
            <p className="text-muted-foreground text-sm mb-3">{video.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-xs bg-dark-lighter py-1 px-2 rounded">{video.resolution}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {video.isLoop === true ? "Loop" : "Pack"}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                Added {video.createdAt ? formatDistanceToNow(new Date(video.createdAt), { addSuffix: true }) : 'recently'}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PlayerModal 
          isOpen={showPreview} 
          onClose={() => setShowPreview(false)} 
          videoUrl={video.previewUrl || ""}
          title={video.title}
        />
      )}
    </>
  );
}
