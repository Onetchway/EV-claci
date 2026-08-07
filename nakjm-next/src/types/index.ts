export type ProjectCategory =
  | "Civil"
  | "Electrical"
  | "Renewables"
  | "EV Charging"
  | "Industrial";

export interface Project {
  slug: string;
  title: string;
  client: string;
  category: ProjectCategory;
  location: string;
  completion: string;
  value?: string;
  hero: string;
  summary: string;
  overview: string[];
  scope: string[];
  metrics: { label: string; value: string }[];
  gallery: { src: string; alt: string }[];
  /** Controls masonry row span so the gallery breaks its grid naturally. */
  span?: "tall" | "wide" | "regular";
}

export interface Service {
  slug: string;
  index: string;
  title: string;
  summary: string;
  intro: string;
  hero: string;
  capabilities: string[];
  deliverables: { title: string; body: string }[];
}

export interface Sector {
  slug: string;
  title: string;
  kicker: string;
  body: string;
  points: string[];
  image: string;
}

export interface TimelineEntry {
  year: string;
  title: string;
  body: string;
  tag?: string;
}

export interface NewsItem {
  slug: string;
  date: string;
  category: string;
  title: string;
  excerpt: string;
  image: string;
}

export interface JobOpening {
  title: string;
  discipline: string;
  location: string;
  type: string;
  experience: string;
}
