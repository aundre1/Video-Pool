// Testimonial data
const testimonials = [
  {
    quote: "VideoPool Pro has been a game-changer for my performances. The quality of the content is unmatched and having fresh visuals every week keeps my sets dynamic and exciting.",
    author: "Alex Rodriguez",
    role: "Club DJ, Miami",
    avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"
  },
  {
    quote: "I've tried several video content services, but VideoPool Pro's library is by far the most comprehensive. The transitions are smooth and the visuals are absolutely stunning. Worth every penny.",
    author: "Sarah Chen",
    role: "Event VJ, Los Angeles",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"
  },
  {
    quote: "The unlimited downloads on the annual plan made this a no-brainer for me. I can now experiment with different visual styles without worrying about running out of credits.",
    author: "Marcus Johnson",
    role: "Festival DJ, Berlin",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"
  }
];

export function Testimonials() {
  return (
    <section className="py-16 bg-dark-lighter">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">What Our Members Say</h2>
          <p className="text-muted-foreground text-lg">Join thousands of professional DJs who trust VideoPool Pro for their visual content needs.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-dark-card p-6 rounded-xl relative">
              <div className="absolute -top-4 -left-4 text-4xl text-primary opacity-50">"</div>
              <p className="mb-6 text-muted-foreground">{testimonial.quote}</p>
              <div className="flex items-center">
                <img 
                  src={testimonial.avatarUrl} 
                  alt={testimonial.author} 
                  className="w-12 h-12 rounded-full mr-4" 
                />
                <div>
                  <h4 className="font-medium">{testimonial.author}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
