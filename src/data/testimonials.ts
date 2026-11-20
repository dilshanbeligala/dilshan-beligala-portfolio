export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  attribution?: string;
}

export const testimonials: readonly Testimonial[] = [];
