import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GetStarted() {
  return (
    <section className="py-16 bg-gradient-to-r from-primary/20 to-secondary/20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl md:text-4xl font-bold mb-4">Ready to Elevate Your Visual Performance?</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join VideoPool Pro today and get instant access to thousands of premium video clips, loops, and transitions.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/register">
            <Button 
              className={cn(
                "bg-gradient-to-r from-primary to-secondary hover:opacity-90 px-8 py-4 text-lg h-auto"
              )}
            >
              Start Free Trial
            </Button>
          </Link>
          <Link href="/browse?filter=free">
            <Button 
              variant="outline" 
              className="bg-dark text-foreground border border-dark-border hover:bg-dark-card px-8 py-4 text-lg h-auto"
            >
              View Sample Content
            </Button>
          </Link>
        </div>
        
        <p className="mt-6 text-muted-foreground">No credit card required for trial. Cancel anytime.</p>
      </div>
    </section>
  );
}
