/** Starter categories for the RSS tab, each with a few well-known feeds to follow. */
export interface CatalogFeed {
  title: string;
  url: string;
}

export const FEED_CATALOG: { category: string; feeds: CatalogFeed[] }[] = [
  {
    category: 'UX',
    feeds: [
      { title: 'Nielsen Norman Group', url: 'https://www.nngroup.com/feed/rss/' },
      { title: 'UX Collective', url: 'https://uxdesign.cc/feed' },
      { title: 'UX Planet', url: 'https://uxplanet.org/feed' },
      { title: 'UXmatters', url: 'https://www.uxmatters.com/index.xml' },
      { title: 'Smashing Magazine: UX', url: 'https://www.smashingmagazine.com/categories/ux-design/index.xml' },
    ],
  },
  {
    category: 'UI',
    feeds: [
      { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
      { title: 'CSS-Tricks', url: 'https://css-tricks.com/feed/' },
      { title: 'Codrops', url: 'https://feeds.feedburner.com/tympanus' },
      { title: 'A List Apart', url: 'https://alistapart.com/main/feed/' },
      { title: 'Sidebar', url: 'https://sidebar.io/feed.xml' },
    ],
  },
  {
    category: 'Coding',
    feeds: [
      { title: 'Hacker News', url: 'https://hnrss.org/frontpage' },
      { title: 'The GitHub Blog', url: 'https://github.blog/feed/' },
      { title: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/' },
      { title: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom' },
      { title: 'Josh W. Comeau', url: 'https://www.joshwcomeau.com/rss.xml' },
      { title: 'DEV Community', url: 'https://dev.to/feed' },
    ],
  },
  {
    category: 'AI News',
    feeds: [
      { title: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
      { title: 'Google AI', url: 'https://blog.google/technology/ai/rss/' },
      { title: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/' },
      { title: 'MIT Technology Review: AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
      { title: 'The Verge: AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
      { title: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
    ],
  },
  {
    category: 'Medical',
    feeds: [
      { title: 'STAT News', url: 'https://www.statnews.com/feed/' },
      { title: 'Medical Xpress', url: 'https://medicalxpress.com/rss-feed/' },
      { title: 'ScienceDaily: Health & Medicine', url: 'https://www.sciencedaily.com/rss/health_medicine.xml' },
      { title: 'WHO News', url: 'https://www.who.int/rss-feeds/news-english.xml' },
      { title: 'The BMJ', url: 'https://www.bmj.com/rss/recent.xml' },
    ],
  },
  {
    category: 'Photography',
    feeds: [
      { title: 'PetaPixel', url: 'https://petapixel.com/feed/' },
      { title: 'DPReview', url: 'https://www.dpreview.com/feeds/news.xml' },
      { title: 'Fstoppers', url: 'https://fstoppers.com/feed' },
      { title: 'Digital Photography School', url: 'https://digital-photography-school.com/feed/' },
      { title: 'Light Stalking', url: 'https://www.lightstalking.com/feed/' },
    ],
  },
  {
    category: 'Tech News',
    feeds: [
      { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
      { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
      { title: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
      { title: 'Wired', url: 'https://www.wired.com/feed/rss' },
    ],
  },
];

export const STARTER_CATEGORIES = FEED_CATALOG.map((c) => c.category);
