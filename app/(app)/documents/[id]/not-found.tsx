export default function DocumentNotFound() {
  return (
    <section className="sheet sheet--narrow" aria-labelledby="doc-missing">
      <header className="sheet-head">
        <h1 id="doc-missing">Document not found</h1>
      </header>
      <div className="empty">
        <p>This document isn’t in your library. It was deleted, or the link belongs to another account.</p>
        <a className="text-action" href="/library">Go to your library</a>
      </div>
    </section>
  );
}
