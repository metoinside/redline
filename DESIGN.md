---
name: Redline
description: The lawyer's marked-up draft. White contract sheets on a manila folder, one red marking ink, and flag tabs on the sheet's edge.
colors:
  manila: "#e5c887"
  manila-deep: "#c9a961"
  manila-ink: "#2b2418"
  manila-dim: "#5a4a2c"
  sheet: "#ffffff"
  ink: "#1c1a17"
  graphite: "#5f5a53"
  rule: "#e4ded3"
  red: "#c8102e"
  tab-yellow: "#f5cf3a"
  tab-blue: "#2459c4"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2.4rem, 4.6vw, 4rem)"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(1.9rem, 3.4vw, 3rem)"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.45rem"
    fontWeight: 600
  document:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.12rem"
    fontWeight: 400
    lineHeight: 1.72
  document-heading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.02rem"
    fontWeight: 600
    letterSpacing: "0.02em"
    fontFeature: "\"smcp\""
  body:
    fontFamily: "Libre Franklin, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  action:
    fontFamily: "Libre Franklin, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1.15
  label:
    fontFamily: "Libre Franklin, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
rounded:
  none: "0px"
  sheet: "2px"
  notice: "3px"
  tab: "6px"
spacing:
  gutter: "clamp(16px, 4vw, 56px)"
  margin-gap: "clamp(24px, 3vw, 40px)"
  section: "clamp(72px, 10vw, 128px)"
  content-max: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "16px 20px 18px 22px"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.document}"
    rounded: "{rounded.sheet}"
    padding: "clamp(14px, 1.4vw, 18px) clamp(24px, 3.6vw, 56px) clamp(40px, 5vw, 72px)"
  flag-tab-negotiate:
    backgroundColor: "{colors.red}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.tab}"
    padding: "10px 14px 10px 26px"
  flag-tab-know:
    backgroundColor: "{colors.tab-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "10px 14px 10px 26px"
  flag-tab-outside:
    backgroundColor: "{colors.tab-blue}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.tab}"
    padding: "10px 14px 10px 26px"
  margin-comment:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "2px 0 4px 14px"
  notice-date:
    textColor: "{colors.ink}"
    rounded: "{rounded.notice}"
    padding: "3px 10px"
  nav-link:
    textColor: "{colors.manila-ink}"
    typography: "{typography.body}"
---

# Design System: Redline

## Overview

**Creative North Star: "The Marked-up Draft"**

Redline looks like a contract that a careful reader has already been through. A manila folder is the ground. Bright white bond sheets sit on it under a soft, warm desk shadow, and the contract text on those sheets is black document ink set in a serif. Redline's work shows up as marks on that draft: a red pen stroke under each cited sentence, a margin comment ruled back to that sentence, a counter-offer set as a tracked insertion, and an adhesive flag tab on the sheet's right edge for each flag, in ranked order. The document is the main object. Interface words sit around it in a plain sans.

The density is a reading desk. The contract measure is generous (1.72 line height, roughly 72 characters), margin comments are compact, and the space around each sheet lets the folder show through as a frame. Motion belongs to the marking. The pen stroke draws as a sentence reaches the reading line, the tab slides out from under the sheet, and when reduced motion is on, every mark is already drawn and every tab is already out.

The world rejects cream, parchment and lamplight (manila is a folder, not aged paper), and it rejects any law-office costume: wood desks, paper texture, torn edges and handwriting typefaces. The pen stroke is a drawn SVG path. It is a mark on the document and is not a handwriting font.

**Key Characteristics:**
- Manila folder ground, white sheet for the document, black ink for contract text.
- One marking ink, Redline red, for citation underlines, counter-offer insertions and the wordmark's pen stroke.
- Three tier colours with fixed meanings, carried by flag tabs and comment swatches.
- Source Serif 4 for the document and headlines, Libre Franklin for interface words.
- Warm brown, soft desk shadows. Nothing is flat grey and nothing has a hard offset.
- Motion draws marks. It never decorates.

## Colors

The palette is a folder, a sheet, and the marks on it: two warm tans with their own inks, white paper with black ink, one red, and two tab colours.

### Primary
- **Redline Red** (`red`): the only marking ink. It draws the pen underline under cited sentences (an 8px-high SVG stroke), the double underline on counter-offer insertions, the stroke under the wordmark, the underline and arrow on the primary action, the hairline rule and leader on margin comments (at 55% opacity), and the soft highlight on the selected citation (8% opacity). It is also the fill of the *Negotiate before signing* tab, and the colour of the final "No flag" outcome in the citation check.

### Secondary
- **Tab Yellow** (`tab-yellow`): the *Know before signing* tier, as a tab fill with ink text and as the comment swatch (with a 1px ink inset so it holds on white). It doubles as the text-selection colour.
- **Tab Blue** (`tab-blue`): the outside-terms notice, as a tab fill with white text and as the comment swatch.

### Neutral
- **Folder Manila** (`manila`): the page ground. On the landing page, interface copy (the letterhead, hero, limits and close) sits directly on it. Contract text never does.
- **Folder Crease** (`manila-deep`): 1px rules on manila (under the letterhead, above the desk heading, between exclusions) and the scrollbar of the mobile tab strip.
- **Folder Ink** (`manila-ink`): running interface text on manila.
- **Folder Ink, Dim** (`manila-dim`): secondary text on manila (the desk heading's note, exclusion descriptions).
- **Bond White** (`sheet`): the document sheet, the citation-check sheet and the primary action's face. White text on red and blue tabs.
- **Document Ink** (`ink`): contract text, headlines, the wordmark, focus outlines and the active-tab ring.
- **Graphite** (`graphite`): secondary text on white: clause numbers, the sheet label, the counter-offer lead-in, the action's sub-line, step notes.
- **Sheet Rule** (`rule`): 1px rules on white (under the sheet label, between check steps).

### Named Rules
**The One Ink Rule.** Red is for marking: underlining a cited sentence, inserting a counter-offer, and the *Negotiate* tier. Red is never used as a background wash, a heading colour or decoration.

**The Fixed Tier Colour Rule.** Red means *Negotiate before signing*, yellow means *Know before signing*, blue means an outside-terms notice. These meanings never change, and these three colours are never used for any other state.

**The Sheet Rule.** Contract text, citations and margin comments always sit on a white sheet in document ink. Manila is the frame around the sheet. It is never the surface a buyer reads a document on.

## Typography

**Display Font:** Source Serif 4 (with Georgia, serif), self-hosted variable woff2, optical sizing on.
**Body Font:** Libre Franklin (with Helvetica Neue, Arial, sans-serif), self-hosted variable woff2.

**Character:** The serif is the document's voice: contract text, its clause headings, and the page's large statements, set heavy (600–650) and tight. Libre Franklin is the instrument's voice: navigation, the action, margin comments, tabs and labels, with tabular figures everywhere so money and dates line up.

### Hierarchy
- **Display** (Source Serif 4 650, clamp(2.4rem, 4.6vw, 4rem), 1.05, -0.015em): the hero headline across the folder, max 17.5em wide.
- **Headline** (Source Serif 4 650, clamp(1.9rem, 3.4vw, 3rem), 1.08, -0.01em): section statements, max about 24ch. The closing statement uses a slightly larger step (clamp(2rem, 4vw, 3.4rem), 1.06).
- **Title** (Source Serif 4 600, 1.45rem): the document's title on the sheet. The desk heading uses the same face and weight at clamp(1.3rem, 1.9vw, 1.6rem).
- **Document** (Source Serif 4 400, 1.12rem, 1.72; 1.06rem under 640px): contract clauses. Unflagged clauses run to 72ch; a flagged clause runs to 36rem so its margin comment fits beside it.
- **Document heading** (Source Serif 4 600, 1.02rem, small caps, 0.02em): numbered clause headings such as "1. Term and renewal".
- **Body** (Libre Franklin 400, 1.0625rem, 1.5; 1rem under 640px): interface copy. The lede steps up to clamp(1.05rem, 1.3vw, 1.2rem) at 1.55 and stops at 46rem.
- **Action** (Libre Franklin 800, 1.3rem, 1.15): the primary action's legend. The wordmark is the same weight at 1.6rem, -0.01em.
- **Label** (Libre Franklin 600, 0.82rem): clause numbers and the sheet label, in graphite. Tab and comment headings use 700 at 1rem; the tier line on a tab is 700 at 0.76rem.

### Named Rules
**The Two Voices Rule.** Whatever the document says is set in Source Serif 4; whatever Redline says about it is set in Libre Franklin. A margin comment never uses the serif, and a contract clause never uses the sans.

## Layout

Content sits in a 1240px column with a fluid gutter (`spacing.gutter`). Large sections are separated by `spacing.section` of vertical space rather than by bands of colour.

The desk is a two-column grid: the sheet (flexible) and a tab rail (248px; 210px under 1100px). The rail tucks 14px under the sheet's right edge, so the tabs read as stuck to the paper. The tab list is sticky 24px from the top. Inside the sheet, a flagged clause is itself two columns: the clause text, then its margin comment (up to 16rem; 14rem under 1100px), separated by `spacing.margin-gap`. A 1px red leader crosses that gap from the comment back to the sentence.

Breakpoints: 1100px narrows the rail and margin; 860px stacks everything into one column; 640px tightens type and step rows. At 860px the tab rail becomes a sticky, horizontally scrolling strip above the sheet on a manila band. Tabs snap into place, each at min(64%, 240px), with rounded tops and the adhesive band along the bottom edge. Margin comments drop under their clause, and their leaders are hidden.

Lists such as the citation-check steps and the exclusions are ruled rows (1px rules, 16–18px vertical padding), not cards.

## Elevation & Depth

Depth is physical: paper on a folder. Sheets and tabs cast soft, warm brown shadows (rgba(60, 40, 10, …)) that fall downward with a negative spread, as if lit from above a desk. Nothing else is raised. Rules and tonal contrast between manila and white do all other separation.

### Shadow Vocabulary
- **Desk shadow** (`box-shadow: 0 1px 2px rgba(60, 40, 10, 0.12), 0 26px 44px -26px rgba(60, 40, 10, 0.5)`): every white sheet resting on manila.
- **Action lift** (`box-shadow: inset 0 0 0 2px #1c1a17, 0 14px 24px -16px rgba(60, 40, 10, 0.55)`; on hover `0 20px 30px -18px rgba(60, 40, 10, 0.6)` with a 2px rise): the primary action, a white card with a 2px ink border drawn as an inset ring.
- **Tab shadow** (`box-shadow: 0 8px 14px -12px rgba(60, 40, 10, 0.6)`): flag tabs. The selected tab adds a 3px ink ring (`0 0 0 3px #1c1a17`).

### Named Rules
**The Desk Light Rule.** Shadows are warm brown, soft and below the object, with a negative spread. No grey or black shadows, no hard offsets, no glow.

## Shapes

Paper is nearly square. Sheets have a 2px radius (`rounded.sheet`). On mobile, only the bottom corners are rounded, because the tab strip sits on top. The primary action is square (`rounded.none`). Flag tabs are rounded only on the edge away from the paper (`rounded.tab`, 0 6px 6px 0 on desktop, 6px 6px 0 0 on mobile). Their 14px end on the paper is a 40%-white band that reads as the adhesive. The notice date is a small 3px-radius box with a 1.5px ink inset. Comment swatches are 12px squares with a 2px radius. Rules are always 1px. The only curves that are not geometric are the pen strokes: the citation underline and the wordmark stroke, both round-capped SVG paths.

## Components

### Buttons
The primary action is a sheet of paper with an instruction on it.
- **Shape:** square corners (0), 2px ink border drawn as an inset ring.
- **Primary:** white face, ink text. The legend is in the action style, underlined 2.5px in red with a 5px offset. A graphite sub-line underneath names the formats ("PDF, DOCX or pasted text"). A 28px red arrow sits in a second column. The padding is uneven on purpose (16px 20px 18px 22px).
- **Hover / Focus:** rises 2px with a deeper desk shadow and the arrow moves 4px right, over 0.35s on the ease-out curve. Active returns to rest. Focus is the global 3px ink outline at a 3px offset. Under 860px it stretches to full width.
- There is no secondary button style. Other actions are text links.

### Navigation
- **Letterhead:** wordmark left (800 weight, ink, with a red pen stroke drawn under it), links right in Libre Franklin 600 at 1rem, manila ink, no underline. On hover the link gets an underline in red. A 1px folder-crease rule closes the row. Under 640px it wraps.

### Cards / Containers
- **Sheet:** white, 2px radius, desk shadow. It has no border. A right-aligned graphite label at the top states what the sheet is, closed by a sheet rule.
- **Folder:** manila is the container for everything else. Sections on it are separated by 1px crease rules, never by boxes.

### Citation (signature)
The cited sentence in the contract, in document ink, carries a red pen underline drawn as a background image. When it reaches the reading line, the background width grows from 0 to 100% over 0.9s. The selected citation takes an 8% red wash. It always shows its clause number in the label style.

### Margin Comment (signature)
This is Redline's note beside a flagged clause, ruled with a 1px red hairline on its left and joined to the sentence by a red leader. It contains a heading with a 12px tier swatch, a sentence on the exposure, and the counter-offer. The counter-offer has a bold "Counter-offer:" lead-in in graphite and ink, and its wording is set as a tracked insertion with a 1px red double underline. A notice obligation adds its deadline as a notice-date box ("Notice by" in graphite 0.85rem, then the date in 700 weight).

### Flag Tab (signature)
Each flag gets one tab on the sheet's edge, ordered by tier and then by money. The tab carries three lines: clause type (700, 1rem), exposure (500, 0.86rem) and tier (700, 0.76rem). Its fill is the tier colour. Tabs start tucked under the sheet (28px left, transparent) and slide out over 0.7s when their citation is marked. Lit tabs re-sort ahead of tucked ones with a 650ms FLIP move. On hover a tab moves 4px out. Selecting a tab scrolls to its sentence, focuses it, and rings the tab in ink. On mobile, unlit tabs show at 45% opacity rather than hiding.

### App shell (intended, not shipped)
The signed-in shell is not built. Its brief carries this world into an Operate frame. Manila is used only for the frame (navigation rail and page ground), never behind working text. The document sits on a white sheet. Red stays the only marking ink. Flag tabs keep their fixed tier colours. A clean result shows no tab colour and is stated in plain words. Notice obligations sit in the margin as dated comments. Library tables use tabular figures. Layout, navigation and controls are standard web components. None of this exists in code yet. The next documentation pass should take it from the build.

## Do's and Don'ts

### Do:
- **Do** put every document on a white sheet (`sheet`) in document ink, with the desk shadow, and let manila show around it.
- **Do** mark a cited sentence with the red pen underline, and set a counter-offer as an insertion with a red double underline.
- **Do** give every flag one tab in its tier colour, ordered by tier and then by money, with clause type, exposure and tier on the tab.
- **Do** set contract text in Source Serif 4 at 1.72 line height and no wider than 72ch, and set interface words in Libre Franklin with tabular figures.
- **Do** separate content with 1px rules (`manila-deep` on manila, `rule` on white) rather than boxes.
- **Do** show every mark drawn and every tab out when reduced motion is on.

### Don't:
- **Don't** use red for anything but a mark or the *Negotiate before signing* tier: no red headings, washes or decoration.
- **Don't** reuse the tier colours for any other meaning, and don't add a fourth severity colour, a score or a high/medium/low scale.
- **Don't** put contract text, citations or working text on manila.
- **Don't** use cream, parchment or lamplight tones. Manila is a folder, not aged paper.
- **Don't** dress the page up as a law office: no wood desk, paper texture, torn edges or handwriting typefaces. The drawn pen stroke is a mark and is not a font.
- **Don't** use grey or black shadows or hard offset shadows. Depth is the warm desk shadow only.
