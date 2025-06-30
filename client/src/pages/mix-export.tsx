import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Loader2, MusicIcon, FileDown, FileVideo, ShieldAlert, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Video {
  id: number;
  title: string;
  duration: number;
  thumbnailUrl: string;
  isPremium: boolean;
  categoryId: number;
  genre?: string;
}

// Main music genres popular with DJs
const musicGenres = [
  "All",
  "Hip-Hop",
  "Pop",
  "Dance",
  "Country",
  "Reggae",
  "R&B",
  "Reggaeton",
  "House",
  "Alternative",
  "Dubstep",
  "Latin",
  "Old School",
  "80's",
  "90's",
  "Electronic",
  "EDM",
  "Techno",
  "Trap",
  "Rock"
];

// Primary video categories (visual types)
const visualCategories = [
  "Visuals",
  "Transitions",
  "Audio React",
  "3D Elements",
  "Loops",
  "Effects"
];

interface MixTemplate {
  id: string;
  name: string;
  description: string;
  includeCuesheet: boolean;
  includeMetadata: boolean;
  includeArtwork: boolean;
  format: 'mp4' | 'jpg' | 'both';
}

export default function MixExportPage() {
  const { toast } = useToast();
  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [mixName, setMixName] = useState('');
  const [includeCuesheet, setIncludeCuesheet] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeArtwork, setIncludeArtwork] = useState(true);
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'jpg' | 'both'>('mp4');
  const [bpm, setBpm] = useState<string>('');
  const [key, setKey] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState('videos');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/mix-templates'],
    select: (data) => data as MixTemplate[],
  });

  // Fetch user favorites
  const { data: favorites, isLoading: favoritesLoading } = useQuery({
    queryKey: ['/api/favorites'],
    select: (data) => data.videos as Video[],
  });

  // Fetch user playlists
  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['/api/playlists'],
  });

  // Fetch recent downloads
  const { data: recentDownloads, isLoading: recentDownloadsLoading } = useQuery({
    queryKey: ['/api/me/recent-downloads'],
    select: (data) => data?.downloads || [],
  });

  // Mutation for creating a mix export
  const exportMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/mix-export', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.downloadUrl) {
        // Redirect to download
        window.location.href = data.downloadUrl;
        
        toast({
          title: "Mix Export Ready",
          description: "Your DJ mix package has been created and is downloading now.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to create mix export",
        variant: "destructive",
      });
    },
  });

  // Apply template selection
  useEffect(() => {
    if (selectedTemplate && templates) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setIncludeCuesheet(template.includeCuesheet);
        setIncludeMetadata(template.includeMetadata);
        setIncludeArtwork(template.includeArtwork);
        setVideoFormat(template.format);
      }
    }
  }, [selectedTemplate, templates]);

  const handleExport = () => {
    if (!mixName) {
      toast({
        title: "Missing Information",
        description: "Please enter a name for your mix",
        variant: "destructive",
      });
      return;
    }

    if (selectedVideos.length === 0) {
      toast({
        title: "No Videos Selected",
        description: "Please select at least one video to include in your mix",
        variant: "destructive",
      });
      return;
    }

    exportMutation.mutate({
      name: mixName,
      videos: selectedVideos,
      includeCuesheet,
      includeMetadata,
      includeArtwork,
      format: videoFormat,
      bpm: bpm ? parseInt(bpm) : undefined,
      key,
      genre,
      notes,
    });
  };

  const toggleVideoSelection = (videoId: number) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId) 
        : [...prev, videoId]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Filter videos based on selected genre and category
  const filterVideos = (videos: any[]) => {
    if (!videos) return [];
    
    return videos.filter(video => {
      // Skip filtering if "All" is selected for both
      if (selectedGenre === 'All' && selectedCategory === 'All') return true;
      
      // Check genre match (if genre is assigned to video)
      const genreMatch = selectedGenre === 'All' || 
        (video.genre && video.genre.includes(selectedGenre));
      
      // Get category name from categoryId (assuming categories are stored with IDs)
      let categoryName = '';
      if (video.categoryName) {
        categoryName = video.categoryName;
      } else if (video.category) {
        categoryName = video.category;
      } else {
        // Default mapping of category IDs to names based on common order
        const categoryMap: {[key: number]: string} = {
          1: 'Visuals',
          2: 'Transitions',
          3: 'Audio React',
          4: '3D Elements',
          5: 'Loops',
          6: 'Effects'
        };
        categoryName = categoryMap[video.categoryId] || '';
      }
      
      // Check category match
      const categoryMatch = selectedCategory === 'All' || 
        categoryName === selectedCategory;
      
      // For genre filter only
      if (selectedGenre !== 'All' && selectedCategory === 'All') {
        return genreMatch;
      }
      
      // For category filter only
      if (selectedGenre === 'All' && selectedCategory !== 'All') {
        return categoryMatch;
      }
      
      // Both filters active
      return genreMatch && categoryMatch;
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
          DJ Mix Export Tools
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Create professional DJ mixes with your favorite videos, including cue sheets for DJ software.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Video Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Videos</CardTitle>
              <CardDescription>
                Choose videos to include in your mix. The order will determine the sequence in the mix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Genre and Visual Category Filters */}
              {/* New Filter Design - Visual Categories First, Genres in Dropdown */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Filter Videos</h3>
                </div>
                
                {/* PRIMARY: Visual Categories */}
                <div className="bg-card border rounded-md p-4 mb-4">
                  <h4 className="font-semibold mb-3">Visual Type</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={selectedCategory === "All" ? "default" : "outline"} 
                      className={`cursor-pointer hover:bg-primary/20 ${
                        selectedCategory === "All" 
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                          : ""
                      }`}
                      onClick={() => setSelectedCategory("All")}
                    >
                      All
                    </Badge>
                    {visualCategories.map((category) => (
                      <Badge 
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"} 
                        className={`cursor-pointer hover:bg-primary/20 ${
                          selectedCategory === category 
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                            : ""
                        }`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* SECONDARY: Music Genres */}
                <div className="bg-card border rounded-md p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold">Music Genre</h4>
                    
                    <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="View All Genres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Genres</SelectItem>
                        {musicGenres.filter(genre => genre !== "All").map((genre) => (
                          <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={selectedGenre === "All" ? "default" : "outline"} 
                      className={`cursor-pointer hover:bg-primary/20 ${
                        selectedGenre === "All" 
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                          : ""
                      }`}
                      onClick={() => setSelectedGenre("All")}
                    >
                      All
                    </Badge>
                    {["Hip-Hop", "Pop", "Dance", "Country", "Reggae", "R&B", "House", "Dubstep", "Latin"].map((genre) => (
                      <Badge 
                        key={genre}
                        variant={selectedGenre === genre ? "default" : "outline"} 
                        className={`cursor-pointer hover:bg-primary/20 ${
                          selectedGenre === genre 
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                            : ""
                        }`}
                        onClick={() => setSelectedGenre(genre)}
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="videos">Recent Downloads</TabsTrigger>
                  <TabsTrigger value="favorites">Favorites</TabsTrigger>
                </TabsList>
                
                <TabsContent value="videos">
                  {recentDownloadsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : recentDownloads?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileVideo className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>You haven't downloaded any videos yet.</p>
                    </div>
                  ) : filterVideos(recentDownloads).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Filter className="mx-auto h-12 w-12 mb-4 opacity-20" />
                      <p>No videos match the selected filters</p>
                      <p className="text-sm mt-2">Try adjusting your genre or category filters</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Video</TableHead>
                          <TableHead className="w-24">Duration</TableHead>
                          <TableHead className="w-24">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterVideos(recentDownloads || []).map((download: any) => (
                          <TableRow key={download.id} className="group">
                            <TableCell>
                              <Checkbox 
                                checked={selectedVideos.includes(download.video.id)} 
                                onCheckedChange={() => toggleVideoSelection(download.video.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-slate-200 dark:bg-slate-800">
                                  {download.video.thumbnailUrl ? (
                                    <img 
                                      src={download.video.thumbnailUrl} 
                                      alt={download.video.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <MusicIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{download.video.title}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatDuration(download.video.duration || 0)}</TableCell>
                            <TableCell>
                              {download.video.isPremium ? (
                                <Badge variant="secondary">Premium</Badge>
                              ) : (
                                <Badge variant="outline">Standard</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
                
                <TabsContent value="favorites">
                  {favoritesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : favorites?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileVideo className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>You haven't added any favorites yet.</p>
                    </div>
                  ) : filterVideos(favorites).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Filter className="mx-auto h-12 w-12 mb-4 opacity-20" />
                      <p>No videos match the selected filters</p>
                      <p className="text-sm mt-2">Try adjusting your genre or category filters</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Video</TableHead>
                          <TableHead className="w-24">Duration</TableHead>
                          <TableHead className="w-24">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterVideos(favorites || []).map((video: Video) => (
                          <TableRow key={video.id} className="group">
                            <TableCell>
                              <Checkbox 
                                checked={selectedVideos.includes(video.id)} 
                                onCheckedChange={() => toggleVideoSelection(video.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-slate-200 dark:bg-slate-800">
                                  {video.thumbnailUrl ? (
                                    <img 
                                      src={video.thumbnailUrl} 
                                      alt={video.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <MusicIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{video.title}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatDuration(video.duration || 0)}</TableCell>
                            <TableCell>
                              {video.isPremium ? (
                                <Badge variant="secondary">Premium</Badge>
                              ) : (
                                <Badge variant="outline">Standard</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <div className="text-sm text-muted-foreground">
                {selectedVideos.length} videos selected. 
                {selectedVideos.length > 0 && (
                  <Button variant="link" onClick={() => setSelectedVideos([])}>
                    Clear selection
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
        
        {/* Right Column - Export Options */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <CardDescription>
                Configure your mix export settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mix-name">Mix Name</Label>
                <Input 
                  id="mix-name" 
                  placeholder="Enter a name for your mix" 
                  value={mixName} 
                  onChange={(e) => setMixName(e.target.value)} 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesLoading ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      templates?.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedTemplate && templates && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {templates.find(t => t.id === selectedTemplate)?.description}
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeVideos" 
                    checked={videoFormat === 'mp4' || videoFormat === 'both'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        if (includeArtwork) setVideoFormat('both');
                        else setVideoFormat('mp4');
                      } else {
                        if (includeArtwork) setVideoFormat('jpg');
                        else setVideoFormat('mp4'); // Can't uncheck both
                      }
                    }}
                  />
                  <Label htmlFor="includeVideos">Include Videos</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeArtwork" 
                    checked={includeArtwork}
                    onCheckedChange={(checked) => {
                      setIncludeArtwork(!!checked);
                      if (checked && videoFormat === 'mp4') setVideoFormat('both');
                      else if (!checked && videoFormat === 'both') setVideoFormat('mp4');
                    }}
                  />
                  <Label htmlFor="includeArtwork">Include Artwork</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeCuesheet" 
                    checked={includeCuesheet}
                    onCheckedChange={(checked) => setIncludeCuesheet(!!checked)}
                  />
                  <Label htmlFor="includeCuesheet">Include Cuesheet</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeMetadata" 
                    checked={includeMetadata}
                    onCheckedChange={(checked) => setIncludeMetadata(!!checked)}
                  />
                  <Label htmlFor="includeMetadata">Include Metadata</Label>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Mix Details (Optional)</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bpm">BPM</Label>
                    <Input 
                      id="bpm" 
                      placeholder="e.g. 128" 
                      value={bpm} 
                      onChange={(e) => setBpm(e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="key">Key</Label>
                    <Input 
                      id="key" 
                      placeholder="e.g. Am" 
                      value={key} 
                      onChange={(e) => setKey(e.target.value)} 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Input 
                    id="genre" 
                    placeholder="e.g. House" 
                    value={genre} 
                    onChange={(e) => setGenre(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input 
                    id="notes" 
                    placeholder="Additional notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={handleExport}
                disabled={exportMutation.isPending || selectedVideos.length === 0 || !mixName}
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Mix...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export DJ Mix
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          {selectedVideos.length > 0 && (
            <div className="mt-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Selected Videos</CardTitle>
                </CardHeader>
                <CardContent className="py-2 max-h-[200px] overflow-y-auto">
                  <div className="space-y-2">
                    {selectedVideos.map((videoId, index) => {
                      const videoData = 
                        recentDownloads?.find((d: any) => d.video.id === videoId)?.video || 
                        favorites?.find((v: any) => v.id === videoId);
                      
                      if (!videoData) return null;
                      
                      return (
                        <div key={videoId} className="flex items-center justify-between py-1 text-sm border-b border-slate-200 dark:border-slate-800 last:border-none">
                          <div className="flex items-center space-x-2">
                            <div className="text-muted-foreground">{index + 1}.</div>
                            <div className="font-medium truncate max-w-[180px]">
                              {videoData.title}
                            </div>
                          </div>
                          <div>{formatDuration(videoData.duration || 0)}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <span>About Download Credits</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Creating a mix export package will count against your monthly download credits.
              Each video included in the mix will use one download credit.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}