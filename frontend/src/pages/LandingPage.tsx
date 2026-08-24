import { Nav } from "../components/landing/Nav";
import { Hero } from "../components/landing/Hero";
import { GraphShowcase } from "../components/landing/GraphShowcase";
import { Paths } from "../components/landing/Paths";
import { Limits } from "../components/landing/Limits";
import { Footer } from "../components/landing/Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      <main>
        <Hero />
        <GraphShowcase />
        <Paths />
        <Limits />
      </main>
      <Footer />
    </div>
  );
}
