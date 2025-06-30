import { Helmet } from "react-helmet";
import { Hero } from "@/components/home/Hero";
import { Categories } from "@/components/home/Categories";
import { FeaturedVideos } from "@/components/home/FeaturedVideos";
import { MembershipSection } from "@/components/home/Membership";
import { Features } from "@/components/home/Features";
import { Testimonials } from "@/components/home/Testimonials";
import { GetStarted } from "@/components/home/GetStarted";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>TheVideoPool - Premium Video Content for DJs</title>
        <meta name="description" content="Access thousands of high-quality video loops, transitions, and visual effects to elevate your DJ performances with TheVideoPool's premium content library." />
      </Helmet>
      
      <Hero />
      <Categories />
      <FeaturedVideos />
      <MembershipSection />
      <Features />
      <Testimonials />
      <GetStarted />
    </>
  );
}
