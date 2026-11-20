export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  href: string;
  category?: string;
}

export const blogPosts: readonly BlogPost[] = [];
