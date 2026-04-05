import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";

export default function HomePage() {
  return (
    <main className="landing-page-theme relative min-h-screen overflow-hidden">
      <Header />
      <Hero />
    </main>
  );
}
