import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/ui/video-card";
import { Video } from "@shared/schema";

type FilterType = "all" | "new" | "trending" | "popular";

export function FeaturedVideos() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  
  const { data: videos, isLoading } = useQuery<Video[]>({
    queryKey: ['/api/videos/featured', activeFilter],
  });

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  // Fallback videos for when API is not available or loading
  const fallbackVideos = [
    {
      id: 1,
      title: "Neon Waves Visualizer",
      description: "Audio reactive looping background",
      thumbnailUrl: "https://images.unsplash.com/photo-1614102073832-030967418971",
      duration: 30,
      resolution: "4K",
      isLoop: true,
      isPremium: true,
      isNew: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    },
    {
      id: 2,
      title: "Geometric Transitions Pack",
      description: "Clean geometric video transitions",
      thumbnailUrl: "https://pixabay.com/get/g753847a840c4b9789922d23dd13163a54dad5b69eba96f32c3892c8bf10a93ff238f4f2c91a31f17a1ca7a8b57ae7bb9f4080014f9544688d991091a26c7583f_1280.jpg",
      duration: 15,
      resolution: "HD",
      isLoop: false,
      isPremium: false,
      isNew: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
    },
    {
      id: 3,
      title: "Digital Particles Flow",
      description: "Reactive particle system background",
      thumbnailUrl: "https://pixabay.com/get/g6d60a1e4cb56ea0a75ba52eee16ddaf87e66a5358fbca2869863ef4e938eedb6854fd26e1f070f3b0db79c3ae36723b035af67dfa636d021ba84839c508dde9b_1280.jpg",
      duration: 105,
      resolution: "4K",
      isLoop: true,
      isPremium: true,
      isNew: false,
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) // 3 weeks ago
    },
    {
      id: 4,
      title: "Glitch Transitions",
      description: "Digital distortion transition effects",
      thumbnailUrl: "https://images.unsplash.com/photo-1598653222000-6b7b7a552625",
      duration: 20,
      resolution: "HD",
      isLoop: false,
      isPremium: false,
      isNew: false,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 1 month ago
    }
  ];

  // Display fallback videos if loading or no videos available
  const displayVideos = isLoading || !videos ? fallbackVideos : videos;

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h2 className="text-2xl md:text-3xl font-bold">Featured Content</h2>
          
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Button 
              variant={activeFilter === "all" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => handleFilterChange("all")}
            >
              All
            </Button>
            <Button 
              variant={activeFilter === "new" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => handleFilterChange("new")}
            >
              New Releases
            </Button>
            <Button 
              variant={activeFilter === "trending" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => handleFilterChange("trending")}
            >
              Trending
            </Button>
            <Button 
              variant={activeFilter === "popular" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => handleFilterChange("popular")}
            >
              Popular
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <Link href="/browse">
            <Button 
              variant="outline" 
              className="inline-flex items-center px-6 py-3 border border-primary text-primary rounded-md hover:bg-primary hover:text-white transition"
            >
              Explore All Content <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
