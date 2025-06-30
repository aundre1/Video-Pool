import { Film, Download, RotateCcw, Eye, Cog, Shield } from "lucide-react";

// Feature data
const features = [
  {
    icon: <Film className="text-primary text-2xl" />,
    title: "Premium Quality",
    description: "All content is created by professional VJs and motion designers, ensuring the highest quality for your performances.",
    colorClass: "bg-primary/20"
  },
  {
    icon: <Download className="text-secondary text-2xl" />,
    title: "Instant Downloads",
    description: "Get what you need, when you need it with our high-speed content delivery network. No waiting, no buffering.",
    colorClass: "bg-secondary/20"
  },
  {
    icon: <RotateCcw className="text-green-500 text-2xl" />,
    title: "Regular Updates",
    description: "Fresh content added weekly so you'll always have new visuals to keep your performances cutting-edge.",
    colorClass: "bg-green-500/20"
  },
  {
    icon: <Eye className="text-amber-500 text-2xl" />,
    title: "Preview Before Download",
    description: "Watch 30-second previews of all content to ensure it fits your needs before using your download credits.",
    colorClass: "bg-amber-500/20"
  },
  {
    icon: <Cog className="text-blue-500 text-2xl" />,
    title: "Compatible Formats",
    description: "All content available in formats compatible with popular VJ software including Resolume, VDMX, and more.",
    colorClass: "bg-blue-500/20"
  },
  {
    icon: <Shield className="text-red-500 text-2xl" />,
    title: "Commercial License",
    description: "Use all content in your commercial performances with our worry-free licensing included in your membership.",
    colorClass: "bg-red-500/20"
  }
];

export function Features() {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">Built for Professional Video DJs</h2>
          <p className="text-muted-foreground text-lg">Our platform is designed to give you the tools and content you need to create unforgettable visual experiences.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-dark-lighter p-6 rounded-xl">
              <div className={`w-14 h-14 ${feature.colorClass} rounded-lg flex items-center justify-center mb-4`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
