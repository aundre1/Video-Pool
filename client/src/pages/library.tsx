import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "wouter";
import { Library, Heart, Play, Download, Trash, Edit, Plus, Share2, Grid, List } from "lucide-react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import InstantPreview from "@/components/video/InstantPreview";
import { MobileVideoCard } from "@/components/video/MobileVideoCard";

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("favorites");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPlaylistData, setNewPlaylistData] = useState({
    name: "",
    description: "",
    isPublic: false
  });
  const [bulkDownloadFormat, setBulkDownloadFormat] = useState("original");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  
  // Redirect if not authenticated
  if (!user) {
    navigate("/login?redirect=/library");
    return null;
  }
  
  // Get favorites
  const { 
    data: favorites, 
    isLoading: favoritesLoading,
    error: favoritesError
  } = useQuery({
    queryKey: ['/api/favorites'],
    queryFn: async () => {
      const response = await fetch('/api/favorites');
      if (!response.ok) throw new Error('Failed to fetch favorites');
      return response.json();
    }
  });
  
  // Get playlists
  const { 
    data: playlists, 
    isLoading: playlistsLoading,
    error: playlistsError
  } = useQuery({
    queryKey: ['/api/playlists'],
    queryFn: async () => {
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error('Failed to fetch playlists');
      return response.json();
    }
  });
  
  // Get single playlist with items
  const { 
    data: selectedPlaylist,
    isLoading: selectedPlaylistLoading,
    error: selectedPlaylistError
  } = useQuery({
    queryKey: ['/api/playlists', selectedPlaylistId],
    queryFn: async () => {
      if (!selectedPlaylistId) return null;
      const response = await fetch(`/api/playlists/${selectedPlaylistId}`);
      if (!response.ok) throw new Error('Failed to fetch playlist');
      return response.json();
    },
    enabled: !!selectedPlaylistId
  });
  
  // Create playlist mutation
  const createPlaylistMutation = useMutation({
    mutationFn: async (data: typeof newPlaylistData) => {
      const response = await apiRequest('POST', '/api/playlists', data);
      if (!response.ok) throw new Error('Failed to create playlist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setIsCreateDialogOpen(false);
      setNewPlaylistData({
        name: "",
        description: "",
        isPublic: false
      });
      toast({
        title: "Playlist Created",
        description: "Your new playlist has been created successfully",
      });
      setActiveTab("playlists");
    },
    onError: (error) => {
      toast({
        title: "Error Creating Playlist",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete favorite mutation
  const deleteFavoriteMutation = useMutation({
    mutationFn: async (videoId: number) => {
      const response = await apiRequest('DELETE', `/api/favorites/${videoId}`);
      if (!response.ok) throw new Error('Failed to remove from favorites');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      toast({
        title: "Removed from Favorites",
        description: "The video has been removed from your favorites",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete playlist mutation
  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId: number) => {
      const response = await apiRequest('DELETE', `/api/playlists/${playlistId}`);
      if (!response.ok) throw new Error('Failed to delete playlist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      if (selectedPlaylistId) {
        setSelectedPlaylistId(null);
      }
      toast({
        title: "Playlist Deleted",
        description: "The playlist has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Update playlist privacy mutation
  const updatePlaylistPrivacyMutation = useMutation({
    mutationFn: async ({ playlistId, isPublic }: { playlistId: number, isPublic: boolean }) => {
      const response = await apiRequest('PUT', `/api/playlists/${playlistId}`, { isPublic });
      if (!response.ok) throw new Error('Failed to update playlist');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      if (selectedPlaylistId) {
        queryClient.invalidateQueries({ queryKey: ['/api/playlists', selectedPlaylistId] });
      }
      
      // If made public, show share dialog
      if (data.isPublic && data.shareToken) {
        const shareUrl = `${window.location.origin}/shared-playlist/${data.shareToken}`;
        setShareUrl(shareUrl);
        setShareDialogOpen(true);
      }
      
      toast({
        title: "Playlist Updated",
        description: `Playlist is now ${data.isPublic ? 'public' : 'private'}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Remove item from playlist mutation
  const removeFromPlaylistMutation = useMutation({
    mutationFn: async ({ playlistId, itemId }: { playlistId: number, itemId: number }) => {
      const response = await apiRequest('DELETE', `/api/playlists/${playlistId}/videos/${itemId}`);
      if (!response.ok) throw new Error('Failed to remove from playlist');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists', selectedPlaylistId] });
      toast({
        title: "Removed from Playlist",
        description: "The video has been removed from the playlist",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Bulk download mutation
  const bulkDownloadMutation = useMutation({
    mutationFn: async ({ type, id, format }: { type: 'favorites' | 'playlist', id?: number, format: string }) => {
      const response = await apiRequest('POST', '/api/bulk-download', { type, id, format });
      if (!response.ok) throw new Error('Failed to process bulk download');
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      
      if (successCount === 0) {
        toast({
          title: "Download Failed",
          description: "None of the videos could be downloaded. Please check your membership status.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Downloads Started",
        description: `${successCount} out of ${data.count} downloads have been initiated`,
      });
      
      // For each successful download, trigger the actual download
      data.results.forEach((result: any) => {
        if (result.success && result.downloadUrl) {
          // Create an invisible anchor to trigger download
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          
          // Remove after a short delay
          setTimeout(() => {
            document.body.removeChild(link);
          }, 100);
        }
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleCreatePlaylist = () => {
    if (!newPlaylistData.name.trim()) {
      toast({
        title: "Error",
        description: "Playlist name is required",
        variant: "destructive",
      });
      return;
    }
    
    createPlaylistMutation.mutate(newPlaylistData);
  };
  
  const handleDeleteFavorite = (videoId: number) => {
    if (confirm("Are you sure you want to remove this video from your favorites?")) {
      deleteFavoriteMutation.mutate(videoId);
    }
  };
  
  const handleDeletePlaylist = (playlistId: number) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylistMutation.mutate(playlistId);
    }
  };
  
  const handleTogglePlaylistPrivacy = (playlistId: number, currentIsPublic: boolean) => {
    updatePlaylistPrivacyMutation.mutate({
      playlistId,
      isPublic: !currentIsPublic
    });
  };
  
  const handleRemoveFromPlaylist = (playlistId: number, itemId: number) => {
    if (confirm("Are you sure you want to remove this video from the playlist?")) {
      removeFromPlaylistMutation.mutate({ playlistId, itemId });
    }
  };
  
  const handleBulkDownload = (type: 'favorites' | 'playlist') => {
    bulkDownloadMutation.mutate({
      type,
      id: type === 'playlist' ? selectedPlaylistId || undefined : undefined,
      format: bulkDownloadFormat
    });
  };
  
  const handleSharePlaylist = (playlistId: number, shareToken?: string) => {
    if (shareToken) {
      const url = `${window.location.origin}/shared-playlist/${shareToken}`;
      setShareUrl(url);
      setShareDialogOpen(true);
    } else {
      // Make playlist public first, which will generate a share token
      updatePlaylistPrivacyMutation.mutate({
        playlistId,
        isPublic: true
      });
    }
  };
  
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied",
      description: "Share link has been copied to clipboard",
    });
  };
  
  const isSmallScreen = window.innerWidth <= 768;
  
  return (
    <div className="container py-8">
      <Helmet>
        <title>My Library | TheVideoPool</title>
        <meta name="description" content="Access your favorite videos and playlists in your personal library at TheVideoPool." />
      </Helmet>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Library className="h-6 w-6" />
          <h1 className="text-2xl font-bold">My Library</h1>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
            {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
                <DialogDescription>
                  Create a new playlist to organize your favorite videos.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Playlist Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Playlist"
                    value={newPlaylistData.name}
                    onChange={(e) => setNewPlaylistData({ ...newPlaylistData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="A collection of my favorite videos"
                    value={newPlaylistData.description}
                    onChange={(e) => setNewPlaylistData({ ...newPlaylistData, description: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="public"
                    checked={newPlaylistData.isPublic}
                    onCheckedChange={(checked) => setNewPlaylistData({ ...newPlaylistData, isPublic: checked })}
                  />
                  <Label htmlFor="public">Make this playlist public</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreatePlaylist}>Create Playlist</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="favorites" className="data-[state=active]:bg-primary">
            <Heart className="h-4 w-4 mr-2" />
            My Crate
          </TabsTrigger>
          <TabsTrigger value="playlists" className="data-[state=active]:bg-primary">
            <Library className="h-4 w-4 mr-2" />
            Playlists
          </TabsTrigger>
          {selectedPlaylistId && (
            <TabsTrigger value="playlist-detail" className="data-[state=active]:bg-secondary">
              <Play className="h-4 w-4 mr-2" />
              Playlist Detail
            </TabsTrigger>
          )}
        </TabsList>
        
        {/* My Favorites / Crate */}
        <TabsContent value="favorites" className="space-y-4">
          {favoritesLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : favoritesError ? (
            <div className="text-center py-12">
              <p className="text-destructive">Error loading favorites</p>
              <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/favorites'] })}>
                Try Again
              </Button>
            </div>
          ) : favorites && favorites.length > 0 ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">My Favorites ({favorites.length})</h2>
                
                <div className="flex gap-2">
                  <select 
                    className="px-3 py-2 bg-background border border-input rounded-md text-sm"
                    value={bulkDownloadFormat}
                    onChange={(e) => setBulkDownloadFormat(e.target.value)}
                  >
                    <option value="original">Original Quality</option>
                    <option value="high">High Quality (1080p)</option>
                    <option value="medium">Medium Quality (720p)</option>
                    <option value="low">Low Quality (Mobile)</option>
                  </select>
                  
                  <Button 
                    variant="default"
                    onClick={() => handleBulkDownload('favorites')}
                    disabled={bulkDownloadMutation.isPending}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                </div>
              </div>
              
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
                {favorites.map((item: any) => (
                  <div key={item.favorite.id} className={viewMode === "list" ? "flex items-center space-x-4 p-4 bg-card rounded-lg" : ""}>
                    {viewMode === "grid" ? (
                      isSmallScreen ? (
                        <MobileVideoCard
                          video={item.video}
                          onPlay={() => navigate(`/video/${item.video.id}`)}
                          onDownload={() => {/* handled internally */}}
                        />
                      ) : (
                        <div className="relative group">
                          <InstantPreview
                            videoId={item.video.id}
                            thumbnailUrl={item.video.thumbnailUrl}
                            title={item.video.title}
                            isPremium={item.video.isPremium}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                            <Button variant="outline" size="sm" onClick={() => handleDeleteFavorite(item.video.id)}>
                              <Trash className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <>
                        <div className="flex-shrink-0 w-32 h-20 relative overflow-hidden rounded-md">
                          <img
                            src={item.video.thumbnailUrl}
                            alt={item.video.title}
                            className="w-full h-full object-cover"
                          />
                          {item.video.isPremium && (
                            <div className="absolute top-1 right-1 bg-gradient-to-r from-primary to-secondary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              Premium
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <h3 className="font-medium text-sm truncate">{item.video.title}</h3>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <span>{item.video.resolution}</span>
                            <span className="mx-1.5">•</span>
                            <span>{Math.floor(item.video.duration / 60)}:{String(Math.floor(item.video.duration % 60)).padStart(2, '0')}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/video/${item.video.id}`)}>
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteFavorite(item.video.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Your Crate is Empty</h3>
              <p className="text-muted-foreground mt-1">
                Start browsing and add videos to your favorites
              </p>
              <Button variant="default" className="mt-4" onClick={() => navigate('/browse')}>
                Browse Videos
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Playlists */}
        <TabsContent value="playlists" className="space-y-4">
          {playlistsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : playlistsError ? (
            <div className="text-center py-12">
              <p className="text-destructive">Error loading playlists</p>
              <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/playlists'] })}>
                Try Again
              </Button>
            </div>
          ) : playlists && playlists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((playlist: any) => (
                <Card key={playlist.playlist.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{playlist.playlist.name}</CardTitle>
                      <Badge variant={playlist.playlist.isPublic ? "default" : "outline"}>
                        {playlist.playlist.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {playlist.playlist.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span>{playlist.itemCount} videos</span>
                      <span className="mx-1.5">•</span>
                      <span>Updated {new Date(playlist.playlist.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => {
                        setSelectedPlaylistId(playlist.playlist.id);
                        setActiveTab("playlist-detail");
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleTogglePlaylistPrivacy(playlist.playlist.id, playlist.playlist.isPublic)}
                      >
                        {playlist.playlist.isPublic ? "Make Private" : "Make Public"}
                      </Button>
                      
                      {playlist.playlist.isPublic && playlist.playlist.shareToken && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleSharePlaylist(playlist.playlist.id, playlist.playlist.shareToken)}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeletePlaylist(playlist.playlist.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Library className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Playlists Yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first playlist to organize your videos
              </p>
              <Button 
                variant="default" 
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Playlist Detail */}
        <TabsContent value="playlist-detail" className="space-y-4">
          {selectedPlaylistLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : selectedPlaylistError ? (
            <div className="text-center py-12">
              <p className="text-destructive">Error loading playlist</p>
              <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/playlists', selectedPlaylistId] })}>
                Try Again
              </Button>
            </div>
          ) : selectedPlaylist ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{selectedPlaylist.playlist.name}</h2>
                    <Badge variant={selectedPlaylist.playlist.isPublic ? "default" : "outline"}>
                      {selectedPlaylist.playlist.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                  {selectedPlaylist.playlist.description && (
                    <p className="text-muted-foreground mt-1">{selectedPlaylist.playlist.description}</p>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground mt-2">
                    <span>{selectedPlaylist.items.length} videos</span>
                    <span className="mx-1.5">•</span>
                    <span>Updated {new Date(selectedPlaylist.playlist.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => handleTogglePlaylistPrivacy(selectedPlaylist.playlist.id, selectedPlaylist.playlist.isPublic)}
                  >
                    {selectedPlaylist.playlist.isPublic ? "Make Private" : "Make Public"}
                  </Button>
                  
                  {selectedPlaylist.playlist.isPublic && selectedPlaylist.playlist.shareToken && (
                    <Button 
                      variant="outline"
                      onClick={() => handleSharePlaylist(selectedPlaylist.playlist.id, selectedPlaylist.playlist.shareToken)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  )}
                  
                  {selectedPlaylist.items.length > 0 && (
                    <div className="flex gap-2">
                      <select 
                        className="px-3 py-2 bg-background border border-input rounded-md text-sm"
                        value={bulkDownloadFormat}
                        onChange={(e) => setBulkDownloadFormat(e.target.value)}
                      >
                        <option value="original">Original Quality</option>
                        <option value="high">High Quality (1080p)</option>
                        <option value="medium">Medium Quality (720p)</option>
                        <option value="low">Low Quality (Mobile)</option>
                      </select>
                      
                      <Button 
                        variant="default"
                        onClick={() => handleBulkDownload('playlist')}
                        disabled={bulkDownloadMutation.isPending}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              <Separator className="my-4" />
              
              {selectedPlaylist.items.length > 0 ? (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-4"}>
                  {selectedPlaylist.items.map((item: any, index: number) => (
                    <div key={item.item.id} className={viewMode === "list" ? "flex items-center space-x-4 p-4 bg-card rounded-lg" : ""}>
                      {viewMode === "grid" ? (
                        isSmallScreen ? (
                          <MobileVideoCard
                            video={item.video}
                            onPlay={() => navigate(`/video/${item.video.id}`)}
                            onDownload={() => {/* handled internally */}}
                          />
                        ) : (
                          <div className="relative group">
                            <div className="absolute top-2 left-2 z-10 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                              {index + 1}
                            </div>
                            <InstantPreview
                              videoId={item.video.id}
                              thumbnailUrl={item.video.thumbnailUrl}
                              title={item.video.title}
                              isPremium={item.video.isPremium}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRemoveFromPlaylist(selectedPlaylist.playlist.id, item.item.id)}
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="w-8 h-8 flex-shrink-0 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-shrink-0 w-32 h-20 relative overflow-hidden rounded-md">
                            <img
                              src={item.video.thumbnailUrl}
                              alt={item.video.title}
                              className="w-full h-full object-cover"
                            />
                            {item.video.isPremium && (
                              <div className="absolute top-1 right-1 bg-gradient-to-r from-primary to-secondary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                Premium
                              </div>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <h3 className="font-medium text-sm truncate">{item.video.title}</h3>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <span>{item.video.resolution}</span>
                              <span className="mx-1.5">•</span>
                              <span>{Math.floor(item.video.duration / 60)}:{String(Math.floor(item.video.duration % 60)).padStart(2, '0')}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/video/${item.video.id}`)}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveFromPlaylist(selectedPlaylist.playlist.id, item.item.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed rounded-lg">
                  <Play className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">This Playlist is Empty</h3>
                  <p className="text-muted-foreground mt-1">
                    Start browsing and add videos to this playlist
                  </p>
                  <Button variant="default" className="mt-4" onClick={() => navigate('/browse')}>
                    Browse Videos
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No playlist selected</p>
              <Button variant="outline" className="mt-4" onClick={() => setActiveTab("playlists")}>
                Go to Playlists
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Share Playlist Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Playlist</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this playlist
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Input readOnly value={shareUrl} />
            <Button variant="outline" onClick={copyShareLink}>Copy</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}