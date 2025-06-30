import { useState } from "react";
import { Link } from "wouter";
import { Play, Download, Heart, Clock, Plus, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface MobileVideoCardProps {
  video: {
    id: number;
    title: string;
    thumbnailUrl: string;
    duration: number;
    resolution: string;
    isPremium: boolean;
    categoryId: number;
  };
  onPlay: () => void;
  onDownload: () => void;
}

export default function MobileVideoCard({ 
  video, 
  onPlay, 
  onDownload 
}: MobileVideoCardProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Check if video is in favorites
  const { data: favoriteData } = useQuery({
    queryKey: ['/api/favorites/check', video.id],
    queryFn: async () => {
      if (!user) return { isFavorite: false };
      const response = await fetch(`/api/favorites/check/${video.id}`);
      if (!response.ok) throw new Error('Failed to check favorite status');
      return response.json();
    },
    enabled: !!user,
  });
  
  const isFavorite = favoriteData?.isFavorite || false;
  
  // Mutations for favorites
  const addToFavoritesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/favorites/${video.id}`);
      if (!response.ok) throw new Error('Failed to add to favorites');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to My Crate",
        description: "Video added to your favorites",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/check', video.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const removeFromFavoritesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/favorites/${video.id}`);
      if (!response.ok) throw new Error('Failed to remove from favorites');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Removed from My Crate",
        description: "Video removed from your favorites",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/check', video.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Get user's playlists
  const { data: playlists } = useQuery({
    queryKey: ['/api/playlists'],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error('Failed to fetch playlists');
      return response.json();
    },
    enabled: !!user,
  });
  
  // Add to playlist mutation
  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId: number) => {
      const response = await apiRequest('POST', `/api/playlists/${playlistId}/videos`, {
        videoId: video.id
      });
      if (!response.ok) throw new Error('Failed to add to playlist');
      return response.json();
    },
    onSuccess: (_, playlistId) => {
      toast({
        title: "Added to Playlist",
        description: "Video added to your playlist",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/playlists', playlistId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Download start mutation
  const startDownloadMutation = useMutation({
    mutationFn: async (format: string = 'original') => {
      const response = await apiRequest('GET', `/api/videos/${video.id}/download?format=${format}`);
      if (!response.ok) throw new Error('Failed to initiate download');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        toast({
          title: "Download Started",
          description: "Your download has begun",
        });
        // Trigger download using the URL
        window.location.href = data.downloadUrl;
      }
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const toggleFavorite = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add videos to favorites",
        variant: "destructive",
      });
      return;
    }
    
    if (isFavorite) {
      removeFromFavoritesMutation.mutate();
    } else {
      addToFavoritesMutation.mutate();
    }
  };
  
  const handleAddToPlaylist = (playlistId: number) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add videos to playlists",
        variant: "destructive",
      });
      return;
    }
    
    addToPlaylistMutation.mutate(playlistId);
  };
  
  const handleDownload = (format: string = 'original') => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to download videos",
        variant: "destructive",
      });
      return;
    }
    
    if (video.isPremium && (!user.membershipId || user.downloadsRemaining === 0)) {
      toast({
        title: "Premium Content",
        description: user.membershipId 
          ? "You have used all your download credits for this period" 
          : "This video requires a premium membership",
        variant: "destructive",
      });
      return;
    }
    
    startDownloadMutation.mutate(format);
    onDownload();
  };
  
  return (
    <Card className="overflow-hidden border-dark-border relative shadow-lg touch-manipulation">
      {/* Main Card with Touch-Friendly UI */}
      <div className="relative aspect-video">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full aspect-video object-cover"
          loading="lazy"
        />
        
        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
        </div>
        
        {/* Premium Badge */}
        {video.isPremium && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-secondary text-white text-xs px-2 py-1 rounded-full">
            Premium
          </div>
        )}
        
        {/* Touch Controls Overlay */}
        <div className="absolute inset-0 flex items-center justify-around bg-black/40">
          <Button 
            onClick={onPlay}
            variant="ghost" 
            className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            size="icon"
          >
            <Play className="h-8 w-8 text-white" />
          </Button>
        </div>
      </div>
      
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link href={`/video/${video.id}`}>
              <a className="block">
                <h3 className="font-medium line-clamp-2 mb-1">{video.title}</h3>
              </a>
            </Link>
            <div className="text-xs text-muted-foreground">{video.resolution}</div>
          </div>
          
          <div className="ml-2 flex space-x-1">
            {/* Favorite Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-primary"
              onClick={toggleFavorite}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
            </Button>
            
            {/* Quick Download Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-primary"
              onClick={() => handleDownload()}
            >
              <Download className="h-5 w-5" />
            </Button>
            
            {/* More Options Menu */}
            <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-primary"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-base">{video.title}</SheetTitle>
                  <SheetDescription className="text-sm">
                    {video.resolution} • {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                  </SheetDescription>
                </SheetHeader>
                <div className="p-4 space-y-4">
                  {/* Download Options */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Download Options</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex justify-start items-center"
                        onClick={() => handleDownload('original')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Original Quality
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex justify-start items-center"
                        onClick={() => handleDownload('high')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        High (1080p)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex justify-start items-center"
                        onClick={() => handleDownload('medium')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Medium (720p)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex justify-start items-center"
                        onClick={() => handleDownload('low')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Low (Mobile)
                      </Button>
                    </div>
                  </div>
                  
                  {/* Add to Playlist */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">Add to Playlist</h3>
                    {user ? (
                      <div className="space-y-2">
                        {playlists && playlists.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2">
                            {playlists.map((playlist: any) => (
                              <Button 
                                key={playlist.playlist.id}
                                variant="outline" 
                                size="sm" 
                                className="flex justify-between items-center w-full"
                                onClick={() => handleAddToPlaylist(playlist.playlist.id)}
                              >
                                <span className="flex items-center">
                                  <Plus className="h-4 w-4 mr-2" />
                                  {playlist.playlist.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {playlist.itemCount} videos
                                </span>
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            You don't have any playlists yet. Create one from your library.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sign in to add this video to a playlist
                      </p>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}