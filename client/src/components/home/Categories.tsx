import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Sparkles, 
  ArrowRight, 
  Waves, 
  Box, 
  Film, 
  Zap
} from "lucide-react";
import { Category } from "@shared/schema";

// Fallback categories for when API is not available or loading
const fallbackCategories = [
  { id: 1, name: "Hip-Hop", slug: "hip-hop", iconName: "Sparkles", itemCount: 250 },
  { id: 2, name: "Pop", slug: "pop", iconName: "ArrowsUpFromLine", itemCount: 180 },
  { id: 3, name: "Dance", slug: "dance", iconName: "Waves", itemCount: 120 },
  { id: 4, name: "Country", slug: "country", iconName: "Box", itemCount: 95 },
  { id: 5, name: "Reggae", slug: "reggae", iconName: "Film", itemCount: 310 },
  { id: 6, name: "R&B", slug: "r-and-b", iconName: "Zap", itemCount: 175 },
];

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case "Sparkles":
      return <Sparkles className="text-primary text-2xl" />;
    case "ArrowsUpFromLine":
      return <ArrowRight className="text-secondary text-2xl" />;
    case "Waves":
      return <Waves className="text-green-500 text-2xl" />;
    case "Box":
      return <Box className="text-amber-500 text-2xl" />;
    case "Film":
      return <Film className="text-red-500 text-2xl" />;
    case "Zap":
      return <Zap className="text-blue-500 text-2xl" />;
    default:
      return <Sparkles className="text-primary text-2xl" />;
  }
};

const getIconBackgroundClass = (iconName: string) => {
  switch (iconName) {
    case "Sparkles":
      return "bg-primary/20 group-hover:bg-primary/30";
    case "ArrowsUpFromLine":
      return "bg-secondary/20 group-hover:bg-secondary/30";
    case "Waves":
      return "bg-green-500/20 group-hover:bg-green-500/30";
    case "Box":
      return "bg-amber-500/20 group-hover:bg-amber-500/30";
    case "Film":
      return "bg-red-500/20 group-hover:bg-red-500/30";
    case "Zap":
      return "bg-blue-500/20 group-hover:bg-blue-500/30";
    default:
      return "bg-primary/20 group-hover:bg-primary/30";
  }
};

export function Categories() {
  // IMPORTANT: We're deliberately not using the API categories here
  // and always using our music genre categories instead
  // This ensures we show music genres regardless of what the API returns
  const displayCategories = fallbackCategories;

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Explore Categories</h2>
          <Link href="/browse?view=categories" className="text-primary flex items-center hover:underline">
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {displayCategories.map((category) => (
            <Link 
              key={category.id} 
              href={`/browse?category=${category.slug}`}
              className="bg-dark-lighter hover:bg-dark-card rounded-lg p-4 text-center transition group"
            >
              <div className={`w-16 h-16 ${getIconBackgroundClass(category.iconName)} rounded-full flex items-center justify-center mx-auto mb-3 transition`}>
                {getIconComponent(category.iconName)}
              </div>
              <h3 className="font-medium">{category.name}</h3>
              <p className="text-muted-foreground text-sm">{category.itemCount}+ items</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
