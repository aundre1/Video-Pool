import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative">
      {/* Hero background image with overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-purple-900/80 to-pink-900/80">
        <img 
          src="https://images.unsplash.com/photo-1516873240891-4bf014598ab4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080" 
          alt="DJ performing with visual effects" 
          className="object-cover w-full h-full mix-blend-overlay opacity-40" 
        />
      </div>
      
      <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">Premium Video Content for Professional DJs</h1>
          <p className="text-xl mb-8">Access thousands of high-quality video loops, transitions, and visual effects to elevate your performances.</p>
          
          <div className="flex flex-wrap gap-4">
            <Link href="/membership">
              <Button 
                className={cn(
                  "bg-gradient-to-r from-primary to-secondary hover:opacity-90 px-6 py-3 text-lg h-auto"
                )}
              >
                Start Your Membership
              </Button>
            </Link>
            <Link href="/browse">
              <Button 
                variant="outline" 
                className="bg-dark-lighter text-foreground border-dark-border hover:bg-dark-card px-6 py-3 text-lg h-auto"
              >
                Browse Library
              </Button>
            </Link>
          </div>
          
          <div className="mt-8 flex items-center">
            <div className="flex -space-x-2">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100" 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-dark" 
              />
              <img 
                src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100" 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-dark" 
              />
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100" 
                alt="User" 
                className="w-10 h-10 rounded-full border-2 border-dark" 
              />
            </div>
            <span className="ml-4 text-muted-foreground">Join <span className="text-white font-semibold">2,500+</span> professional DJs worldwide</span>
          </div>
        </div>
      </div>
    </section>
  );
}
