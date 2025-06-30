import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Membership as MembershipType } from "@shared/schema";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type MembershipFeature = {
  feature: string;
  included: boolean;
};

function MembershipFeature({ feature }: { feature: MembershipFeature }) {
  return (
    <li className="flex items-start">
      {feature.included ? (
        <>
          <Check className="text-green-500 mt-1 mr-3 h-4 w-4 flex-shrink-0" />
          <span>{feature.feature}</span>
        </>
      ) : (
        <>
          <X className="text-muted-foreground mt-1 mr-3 h-4 w-4 flex-shrink-0" />
          <span className="text-muted-foreground">{feature.feature}</span>
        </>
      )}
    </li>
  );
}

// Fallback memberships for when API is not available or loading
const fallbackMemberships = [
  {
    id: 0,
    name: "Free Trial",
    price: 0,
    billingCycle: "monthly",
    downloadLimit: 1,
    features: [
      { feature: "1 download per month", included: true },
      { feature: "Preview all content", included: true },
      { feature: "Limited to 6 months", included: true },
      { feature: "SD quality videos only", included: true },
      { feature: "Basic support", included: true },
    ],
    isPopular: false,
    isTrial: true
  },
  {
    id: 1,
    name: "Monthly",
    price: 34.99,
    billingCycle: "monthly",
    downloadLimit: 200,
    features: [
      { feature: "200 downloads per month", included: true },
      { feature: "Full HD quality videos", included: true },
      { feature: "Cancel anytime", included: true },
      { feature: "Basic support", included: true },
      { feature: "4K video content", included: true },
    ],
    isPopular: false
  },
  {
    id: 2,
    name: "Quarterly",
    price: 99.99,
    billingCycle: "quarterly",
    downloadLimit: 250,
    features: [
      { feature: "250 downloads per month", included: true },
      { feature: "4K video content", included: true },
      { feature: "Priority downloads", included: true },
      { feature: "Priority support", included: true },
      { feature: "Early access to new content", included: true },
    ],
    isPopular: true
  },
  {
    id: 3,
    name: "Annual",
    price: 329.99,
    billingCycle: "annual",
    downloadLimit: 300,
    features: [
      { feature: "300 downloads per month", included: true },
      { feature: "8K video content (where available)", included: true },
      { feature: "Bulk download capability", included: true },
      { feature: "24/7 priority support", included: true },
      { feature: "Custom requests (1 per quarter)", included: true },
    ],
    isPopular: false
  }
];

export default function MembershipPage() {
  const [_, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  
  const { data: memberships, isLoading } = useQuery<MembershipType[]>({
    queryKey: ['/api/memberships'],
  });
  
  // Display fallback memberships if loading or no memberships available
  const displayMemberships = isLoading || !memberships ? fallbackMemberships : memberships;
  
  const handleSubscribe = (planId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe to a membership plan",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    
    // If user already has a membership, ask for confirmation
    if (user?.membershipId) {
      // Would handle with a confirmation dialog in a real implementation
      toast({
        title: "Membership Change",
        description: "You already have an active membership. Please contact support to change your plan.",
        variant: "destructive",
      });
      return;
    }
    
    // Navigate to checkout page with plan ID
    setLocation(`/checkout?plan=${planId}`);
  };

  return (
    <>
      <Helmet>
        <title>Membership Plans - TheVideoPool</title>
        <meta name="description" content="Choose a membership plan to get access to premium DJ video content with flexible pricing options from TheVideoPool." />
      </Helmet>
      
      <div className="py-16 bg-gradient-to-br from-background to-purple-900/20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Membership</h1>
            <p className="text-muted-foreground text-lg">Get unlimited access to premium video content with our flexible membership options.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {displayMemberships.map((plan) => (
              <div 
                key={plan.id}
                className={cn(
                  "bg-dark-card rounded-xl overflow-hidden relative transform transition-all duration-300 group",
                  plan.isPopular 
                    ? "border-2 border-primary md:scale-105 z-10 hover:scale-110 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]" 
                    : "border border-dark-border hover:scale-105 hover:border-transparent hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                {plan.isPopular && (
                  <div className="absolute top-0 right-0 bg-primary text-white py-1 px-3 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">${typeof plan.price === 'number' && plan.price > 1000 ? (plan.price / 100).toFixed(2) : plan.price}</span>
                    <span className="text-muted-foreground">/{plan.billingCycle}</span>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    {plan.billingCycle === "monthly" && "Perfect for DJs who need regular access to fresh content."}
                    {plan.billingCycle === "quarterly" && "Great value with 250 downloads per month."}
                    {plan.billingCycle === "annual" && "Best value with 300 downloads per month. Save 5% with annual plan."}
                  </p>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <MembershipFeature key={index} feature={feature} />
                    ))}
                  </ul>
                  
                  <Button 
                    className={cn(
                      "block w-full py-3 rounded-md relative overflow-hidden group-hover:shadow-lg transition-all duration-300",
                      "bg-gradient-to-r from-primary to-secondary text-white"
                    )}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    <span className="relative z-10">Get Started</span>
                    <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center text-muted-foreground">
            <p className="mt-2">Need a custom enterprise plan? <Link href="/contact" className="text-primary hover:underline">Contact us</Link></p>
          </div>
          
          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto mt-24">
            <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              <div className="bg-dark-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">What happens if I reach my download limit?</h3>
                <p className="text-muted-foreground">Download limits reset at the beginning of each billing cycle. If you need more downloads, you can upgrade to a higher tier plan at any time.</p>
              </div>
              
              <div className="bg-dark-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">Can I cancel my subscription?</h3>
                <p className="text-muted-foreground">Yes, you can cancel your subscription at any time. Your access will remain active until the end of your current billing period.</p>
              </div>
              
              <div className="bg-dark-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">What payment methods do you accept?</h3>
                <p className="text-muted-foreground">We accept all major credit cards, PayPal, and Apple Pay. All payments are processed securely through our payment provider.</p>
              </div>
              
              <div className="bg-dark-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">Is there a free trial available?</h3>
                <p className="text-muted-foreground">Yes, we offer a 7-day free trial for new members. You can explore our platform and preview content before committing to a subscription.</p>
              </div>
              
              <div className="bg-dark-card rounded-xl p-6">
                <h3 className="text-lg font-bold mb-2">Can I use the content commercially?</h3>
                <p className="text-muted-foreground">Yes, all content downloaded with an active membership includes a commercial license for use in your DJ performances, events, and online streams.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
