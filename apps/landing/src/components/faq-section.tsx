import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/reveal";
import { faqs } from "@/lib/content";

export function FaqSection() {
  return (
    <section id="faq" className="section-shell scroll-mt-28">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <h2 className="section-title">FAQ</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="border-t border-ink/10">
            {faqs.map((faq, index) => (
              <AccordionItem value={`faq-${index}`} key={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
