import { LandingMotion } from "./landing-motion";

// The landing page, ported from the static landing/index.html with its markup
// and copy unchanged. The flag-tab motion lives in LandingMotion.
export default function LandingPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>

      <header className="top">
        <nav className="letterhead" aria-label="Main">
          <a className="wordmark" href="/">
            <span>Redline</span>
            <svg className="stroke" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8.5C22 5 48 4.2 70 5.4c17 .9 32 2.4 47 1.6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/></svg>
          </a>
          <ul>
            <li><a href="#how">How it reads</a></li>
            <li><a href="#limits">What it won’t do</a></li>
            <li><a href="/sign-in">Sign in</a></li>
          </ul>
        </nav>
        <div className="hero">
          <h1>See the renewal and exit terms in your contract before you sign.</h1>
          <div className="hero-foot">
            <p className="lede">Redline reads your vendor, SaaS or service contract and flags auto-renewals, notice windows, early termination fees, rollovers and multi-year terms, each with the exact sentence it came from.</p>
            <a className="try" href="/new">
              <span className="try-legend">Try it on a document</span>
              <span className="try-sub">PDF, DOCX or pasted text</span>
              <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="desk" id="how" aria-labelledby="how-title">
          <div className="desk-head">
            <h2 id="how-title">A sample contract, read the way Redline reads yours</h2>
            <p>We wrote this contract for this page. Northwind isn’t a real company.</p>
          </div>

          <div className="desk-body">
            <article className="sheet" aria-label="Sample contract: Northwind services agreement">
              <p className="sheet-label">Sample contract, made up for this page</p>
              <h3 className="doc-title">Services Agreement</h3>
              <div className="clause"><p className="doc">This Services Agreement is between Northwind Facilities Ltd (“Northwind”) and the customer named in the Order (“Customer”), effective 1 January 2026 (the “Effective Date”).</p></div>

              <h4 className="doc-head">1. Term and renewal</h4>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">1.1</span> <mark id="c-term" tabIndex={-1} className="cite">The Initial Term is thirty-six (36) months from the Effective Date, at an annual fee of $18,000.</mark></p>
                <aside className="comment comment--negotiate" aria-label="Flag: multi-year term">
                  <p className="comment-type">Multi-year term</p>
                  <p>You’re committed for three years. At $18,000 a year, that’s $54,000.</p>
                  <p className="counter"><span>Counter-offer:</span> <ins>“Can we make the Initial Term 12 months, with an option to renew?”</ins></p>
                </aside>
              </div>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">1.2</span> <mark id="c-renew" tabIndex={-1} className="cite">At the end of the Initial Term, this Agreement renews automatically for successive twelve (12) month Renewal Terms at the annual fee then in effect.</mark></p>
                <aside className="comment comment--negotiate" aria-label="Flag: auto-renewal">
                  <p className="comment-type">Auto-renewal</p>
                  <p>If nobody gives notice, it renews for another 12 months at whatever the fee is then.</p>
                  <p className="counter"><span>Counter-offer:</span> <ins>“Please change this so the agreement ends with the Initial Term unless we both agree in writing to renew.”</ins></p>
                </aside>
              </div>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">1.3</span> <mark id="c-roll" tabIndex={-1} className="cite">Each Renewal Term is on the same terms as this Agreement.</mark></p>
                <aside className="comment comment--know" aria-label="Flag: rollover">
                  <p className="comment-type">Rollover</p>
                  <p>Every renewal keeps the terms of this agreement unchanged.</p>
                  <p className="counter"><span>Counter-offer:</span> <ins>“Please add that either of us can propose new terms at least 60 days before a renewal starts.”</ins></p>
                </aside>
              </div>

              <h4 className="doc-head">2. Services</h4>
              <div className="clause"><p className="doc"><span className="ref">2.1</span> Northwind will clean the premises listed in the Order and collect their waste five days a week.</p></div>

              <h4 className="doc-head">3. Fees</h4>
              <div className="clause"><p className="doc"><span className="ref">3.1</span> Northwind invoices the annual fee in twelve equal monthly instalments, each payable within thirty (30) days.</p></div>
              <div className="clause"><p className="doc"><span className="ref">3.2</span> Northwind may charge interest on late payments at 1% a month.</p></div>

              <h4 className="doc-head">7. Liability</h4>
              <div className="clause"><p className="doc"><span className="ref">7.1</span> Northwind’s total liability under this Agreement is limited to the fees paid in the previous three (3) months.</p></div>

              <h4 className="doc-head">8. Ending this Agreement</h4>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">8.3</span> <mark id="c-fee" tabIndex={-1} className="cite">If Customer ends this Agreement before the end of the Initial Term, Customer will pay an early termination fee equal to all fees remaining for the Initial Term.</mark></p>
                <aside className="comment comment--negotiate" aria-label="Flag: early termination fee">
                  <p className="comment-type">Early termination fee</p>
                  <p>Leaving early costs every fee left in the three years. Leave after one year and the fee is $36,000.</p>
                  <p className="counter"><span>Counter-offer:</span> <ins>“Please cap the early termination fee at three months of fees.”</ins></p>
                </aside>
              </div>

              <h4 className="doc-head">9. Notices</h4>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">9.2</span> <mark id="c-notice" tabIndex={-1} className="cite">To stop a renewal, a party must give written notice of non-renewal at least ninety (90) days before the end of the current term.</mark></p>
                <aside className="comment comment--negotiate" aria-label="Flag: notice window">
                  <p className="comment-type">Notice window</p>
                  <p className="due"><span>Notice by</span> 2 Oct 2028</p>
                  <p>To stop the first renewal, your written notice has to reach Northwind by 2 October 2028, 90 days before the Initial Term ends on 31 December 2028.</p>
                  <p className="counter"><span>Counter-offer:</span> <ins>“Please shorten the notice period to 30 days, and accept notice by email.”</ins></p>
                </aside>
              </div>

              <h4 className="doc-head">11. General</h4>
              <div className="clause clause--flag">
                <p className="doc"><span className="ref">11.1</span> <mark id="c-outside" tabIndex={-1} className="cite">Customer’s use of the Services is also governed by the Northwind Service Terms at northwind.example/terms.</mark></p>
                <aside className="comment comment--outside" aria-label="Outside-terms notice">
                  <p className="comment-type">Outside terms</p>
                  <p>Part of this contract lives in another document. Upload the Northwind Service Terms as a document of their own to see what they say about renewal and exit. Until then, this contract can’t get a clean result.</p>
                </aside>
              </div>
            </article>

            <div className="rail">
              <ol className="tabs" aria-label="Flags and notices for the sample contract, ranked">
                <li data-rank="1">
                  <button className="tab tab--negotiate" type="button" data-target="c-term">
                    <span className="tab-type">Multi-year term</span>
                    <span className="tab-exposure">36 months at $18,000 a year</span>
                    <span className="tab-tier">Negotiate before signing</span>
                  </button>
                </li>
                <li data-rank="2">
                  <button className="tab tab--negotiate" type="button" data-target="c-fee">
                    <span className="tab-type">Early termination fee</span>
                    <span className="tab-exposure">Every fee left in the Initial Term</span>
                    <span className="tab-tier">Negotiate before signing</span>
                  </button>
                </li>
                <li data-rank="3">
                  <button className="tab tab--negotiate" type="button" data-target="c-renew">
                    <span className="tab-type">Auto-renewal</span>
                    <span className="tab-exposure">Renews 12 months at a time</span>
                    <span className="tab-tier">Negotiate before signing</span>
                  </button>
                </li>
                <li data-rank="4">
                  <button className="tab tab--negotiate" type="button" data-target="c-notice">
                    <span className="tab-type">Notice window</span>
                    <span className="tab-exposure">90 days, in writing</span>
                    <span className="tab-tier">Negotiate before signing</span>
                  </button>
                </li>
                <li data-rank="5">
                  <button className="tab tab--know" type="button" data-target="c-roll">
                    <span className="tab-type">Rollover</span>
                    <span className="tab-exposure">Same terms carry over</span>
                    <span className="tab-tier">Know before signing</span>
                  </button>
                </li>
                <li data-rank="6">
                  <button className="tab tab--outside" type="button" data-target="c-outside">
                    <span className="tab-type">Northwind Service Terms</span>
                    <span className="tab-exposure">Not in this document</span>
                    <span className="tab-tier">Outside terms</span>
                  </button>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="check" aria-labelledby="check-title">
          <div className="check-sheet">
            <h2 id="check-title">If the sentence isn’t in your document, there’s no flag.</h2>
            <p className="check-lede">Redline shows a flag only when the sentence it quotes appears word for word in your document. You can find it in your document and judge the clause for yourself.</p>
            <ol className="steps">
              <li><span>Your file is read in your browser</span><span className="step-note">Only the text is saved</span></li>
              <li><span>Each quoted sentence is checked against that text</span><span className="step-note">Word for word, in code</span></li>
              <li><span>No exact match</span><span className="step-note">No flag</span></li>
            </ol>
          </div>
        </section>

        <section className="limits" id="limits" aria-labelledby="limits-title">
          <div className="limits-copy">
            <h2 id="limits-title">What Redline won’t do</h2>
            <p>Redline reads your contract for renewal and exit terms. These are the things it leaves to you or doesn’t do at all.</p>
          </div>
          <ul className="exclusions">
            <li>
              <strong>No verdict on whether to sign</strong>
              <span>It shows what the contract says. The decision stays with you.</span>
            </li>
            <li>
              <strong>No legal advice</strong>
              <span>It won’t tell you what the law says or how it applies to your contract.</span>
            </li>
            <li>
              <strong>No scanned or photographed documents</strong>
              <span>If a file has no text Redline can read, it says so and stops. A misread sentence can’t be checked.</span>
            </li>
            <li>
              <strong>Vendor, SaaS and service contracts</strong>
              <span>You can upload other documents, but nobody has checked the results for them.</span>
            </li>
            <li>
              <strong>Five clause types only</strong>
              <span>Auto-renewal, notice windows, early termination fees, rollover and multi-year terms. Nothing on liability, indemnity or price rises.</span>
            </li>
          </ul>
        </section>

        <section className="close" aria-labelledby="close-title">
          <h2 id="close-title">Read your next contract before it renews.</h2>
          <p>Upload a PDF or DOCX or paste the text, with or without an account. The file stays in your browser and only its text is saved.</p>
          <a className="try" href="/new">
            <span className="try-legend">Try it on a document</span>
            <span className="try-sub">PDF, DOCX or pasted text</span>
            <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"/></svg>
          </a>
        </section>
      </main>

      <footer className="foot">
        <span className="foot-mark">Redline</span>
        <p>The sample contract on this page is made up. Northwind isn’t a real company.</p>
        <a href="/sign-in">Sign in</a>
      </footer>
      <LandingMotion />
    </>
  );
}
