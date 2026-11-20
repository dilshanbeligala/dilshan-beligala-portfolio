import { blogPosts, type BlogPost } from "@/data/blogs";
import "../editorial-sections.css";

export function BlogsSection({ posts = blogPosts }: { posts?: readonly BlogPost[] }) {
  return <section id="blogs" className="editorial-section" aria-labelledby="blogs-heading">
    <header className="editorial-section-heading">
      <p>08 / INSIGHTS &amp; WRITING</p>
      <h2 id="blogs-heading">Thoughts, Code &amp; Beyond.</h2>
    </header>
    {posts.length > 0 && <ul className="editorial-section-grid" role="list">
      {posts.map(post => <li key={post.id}>
        <article>
          {post.category && <p className="editorial-post-category">{post.category}</p>}
          <h3><a href={post.href}>{post.title}</a></h3>
          <p>{post.summary}</p>
        </article>
      </li>)}
    </ul>}
  </section>;
}
