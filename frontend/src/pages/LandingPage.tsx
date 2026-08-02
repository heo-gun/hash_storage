import { Nav } from "../components/landing/Nav";
import { Hero } from "../components/landing/Hero";
import { Features } from "../components/landing/Features";
import { HowItWorks } from "../components/landing/HowItWorks";
import { GraphShowcase } from "../components/landing/GraphShowcase";
import { Footer } from "../components/landing/Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <GraphShowcase />
      </main>
      <Footer />
    </div>
  );
}
