import { Navigation } from "@/components/navigation";
import { Hero } from "@/components/hero";
import { TrustStrip } from "@/components/trust-strip";
import { JourneySection } from "@/components/journey-section";
import { SecuritySection } from "@/components/security-section";
import { OrganizerSection } from "@/components/organizer-section";
import { FaqSection } from "@/components/faq-section";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function LandingPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navigation />
      <main id="main-content">
        <Hero />
        <TrustStrip />
        <JourneySection />
        <SecuritySection />
        <OrganizerSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
