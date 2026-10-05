// Shown on account pages when this server has no Supabase project connected.
export function AccountsOff({ title }: { title: string }) {
  return (
    <section className="sheet sheet--narrow" aria-labelledby="accounts-off">
      <header className="sheet-head">
        <h1 id="accounts-off">{title}</h1>
      </header>
      <div className="prose">
        <p className="message" role="status">
          <strong>Accounts aren’t set up on this server.</strong>
          This copy of Redline has no account service connected, so you can’t sign in or keep a library here.
        </p>
      </div>
    </section>
  );
}
