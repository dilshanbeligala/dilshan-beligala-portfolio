import { testimonials, type Testimonial } from "@/data/testimonials";
import "../editorial-sections.css";

export function TestimonialsSection({ items = testimonials }: { items?: readonly Testimonial[] }) {
  return <section id="testimonials" className="editorial-section" aria-labelledby="testimonials-heading">
    <header className="editorial-section-heading">
      <p>07 / TESTIMONIALS</p>
      <h2 id="testimonials-heading">Words That Matter.</h2>
    </header>
    {items.length > 0 && <ul className="editorial-section-grid" role="list">
      {items.map(item => <li key={item.id}>
        <figure>
          <blockquote><p>{item.quote}</p></blockquote>
          <figcaption>
            <strong>{item.name}</strong>
            {item.attribution && <span>{item.attribution}</span>}
          </figcaption>
        </figure>
      </li>)}
    </ul>}
  </section>;
}
