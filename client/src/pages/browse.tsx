import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import { VideoCard } from "@/components/ui/video-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Categories } from "@/components/home/Categories";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { Video, Category } from "@shared/schema";
import { VIDEO_CATEGORIES, VISUAL_CATEGORIES } from "@/lib/constants";

export default function Browse() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedResolution, setSelectedResolution] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState("newest");
  
  // Parse URL search params
  const location = useLocation();
  const params = new URLSearchParams(window.location.search);
  const categoryParam = params.get("category");
  const viewParam = params.get("view");
  
  // Set initial states based on URL params
  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
    
    if (viewParam === "categories") {
      setActiveTab("categories");
    }
  }, [categoryParam, viewParam]);

  // Fetch videos with filters
  const { data: videosData, isLoading: isLoadingVideos } = useQuery<{videos: Video[], total: number}>({
    queryKey: [
      `/api/videos?search=${searchTerm}&category=${selectedCategory}&sort=${selectedSort}${selectedResolution ? `&resolution=${selectedResolution}` : ''}${activeTab === 'premium' ? '&premium=true' : activeTab === 'free' ? '&premium=false' : ''}${activeTab === 'loops' ? '&loop=true' : ''}`,
    ],
  });

  // Fetch categories
  const { data: categories, isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Get videos from the API response
  const videos = videosData?.videos || [];
  
  // Display UI for loading state
  const isLoading = isLoadingVideos || isLoadingCategories;

  return (
    <>
      <Helmet>
        <title>Browse Content - VideoPool Pro</title>
        <meta name="description" content="Browse our collection of premium DJ video content including loops, transitions, visuals, and effects." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Browse Content</h1>
          
          {/* Search and filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Input 
                placeholder="Search videos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  
                  {/* Music Genres */}
                  <SelectItem value="section-header-genres" disabled>
                    ── Music Genres ──
                  </SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>{category.name}</SelectItem>
                  ))}
                  
                  {/* Visual Categories */}
                  <SelectItem value="section-header-visuals" disabled>
                    ── Visual Types ──
                  </SelectItem>
                  {VISUAL_CATEGORIES.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedResolution} onValueChange={setSelectedResolution}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Resolutions</SelectItem>
                  <SelectItem value="4K">4K</SelectItem>
                  <SelectItem value="HD">HD</SelectItem>
                  <SelectItem value="8K">8K</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedSort} onValueChange={setSelectedSort}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="downloads">Most Downloads</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All Content</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="free">Free</TabsTrigger>
              <TabsTrigger value="loops">Loops</TabsTrigger>
              <TabsTrigger value="transitions">Transitions</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>
            
            <TabsContent value="categories">
              <Categories />
            </TabsContent>
            
            {activeTab !== "categories" && (
              <>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
                    {[...Array(8)].map((_, index) => (
                      <div key={index} className="bg-dark-card rounded-xl overflow-hidden animate-pulse">
                        <div className="w-full aspect-video bg-dark-lighter"></div>
                        <div className="p-4">
                          <div className="h-6 bg-dark-lighter rounded mb-2 w-3/4"></div>
                          <div className="h-4 bg-dark-lighter rounded mb-4 w-1/2"></div>
                          <div className="flex justify-between">
                            <div className="h-4 bg-dark-lighter rounded w-1/4"></div>
                            <div className="h-4 bg-dark-lighter rounded w-1/4"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : videos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
                    {videos.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Filter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">No videos found</h3>
                    <p className="text-muted-foreground mb-6">
                      Try adjusting your search or filter criteria
                    </p>
                    <Button onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("");
                      setSelectedResolution("");
                      setSelectedSort("newest");
                    }}>
                      Clear Filters
                    </Button>
                  </div>
                )}
              </>
            )}
          </Tabs>
        </div>
      </div>
    </>
  );
}
