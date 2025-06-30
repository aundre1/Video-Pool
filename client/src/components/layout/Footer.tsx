import { Link } from "wouter";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-dark-lighter pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <Link href="/" className="flex items-center mb-4">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                VideoPool<span className="text-white">Pro</span>
              </span>
            </Link>
            <p className="text-muted-foreground mb-4">Premium video content platform for professional DJs and VJs.</p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-muted-foreground hover:text-primary transition">Home</Link></li>
              <li><Link href="/browse" className="text-muted-foreground hover:text-primary transition">Browse Content</Link></li>
              <li><Link href="/membership" className="text-muted-foreground hover:text-primary transition">Membership Plans</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition">About Us</Link></li>
              <li><Link href="/blog" className="text-muted-foreground hover:text-primary transition">Blog</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Categories</h4>
            <ul className="space-y-2">
              <li><Link href="/browse?category=visuals" className="text-muted-foreground hover:text-primary transition">Visuals</Link></li>
              <li><Link href="/browse?category=transitions" className="text-muted-foreground hover:text-primary transition">Transitions</Link></li>
              <li><Link href="/browse?category=audio-reactive" className="text-muted-foreground hover:text-primary transition">Audio Reactive</Link></li>
              <li><Link href="/browse?category=3d-elements" className="text-muted-foreground hover:text-primary transition">3D Elements</Link></li>
              <li><Link href="/browse?category=loops" className="text-muted-foreground hover:text-primary transition">Loops</Link></li>
              <li><Link href="/browse?category=effects" className="text-muted-foreground hover:text-primary transition">Effects</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link href="/help" className="text-muted-foreground hover:text-primary transition">Help Center</Link></li>
              <li><Link href="/faq" className="text-muted-foreground hover:text-primary transition">FAQs</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition">Privacy Policy</Link></li>
              <li><Link href="/licensing" className="text-muted-foreground hover:text-primary transition">Licensing</Link></li>
              <li><Link href="/contact?support=true" className="text-muted-foreground hover:text-primary transition">Contact Support</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-dark-border pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm mb-4 md:mb-0">© 2023 VideoPool Pro. All rights reserved.</p>
          <div className="flex space-x-4">
            <Link href="/terms" className="text-muted-foreground hover:text-primary text-sm transition">Terms</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-primary text-sm transition">Privacy</Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-primary text-sm transition">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
