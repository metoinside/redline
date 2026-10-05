---
name: Redline
description: Renewal and exit terms, signed like the road. Interstate guide and warning signage over the contract text.
colors:
  guide: "#00613a"
  guide-deep: "#004d2e"
  legend: "#ffffff"
  legend-soft: "#e3efe8"
  regulatory: "#b3121f"
  warning: "#ffc72c"
  construction: "#f26b1d"
  sign-ink: "#111311"
  marking: "#f2c230"
  asphalt: "#2a2a28"
  road-text: "#e8e9e4"
  road-dim: "#b0aea6"
  lane: "#e8e9e4"
  sky: "#d8dfe2"
  sky-ink: "#1b2328"
  steel: "#737c82"
  steel-dark: "#4b5257"
  exit-sub: "#2f5c47"
  exit-hover: "#f2fbf6"
  plate-text: "#2b3134"
typography:
  display:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.3rem, 4.4vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0.005em"
  title:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.4rem, 2vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "0.005em"
  sign-legend:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.3rem, 1.7vw, 1.6rem)"
    fontWeight: 800
    lineHeight: 1.1
  flag-type:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  document:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.16rem"
    fontWeight: 400
    lineHeight: 1.7
  document-title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 600
  label:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 800
    letterSpacing: "0.05em"
  tier:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  cite: "2px"
  tag: "4px"
  plate: "8px"
  panel: "10px"
  sign: "14px"
spacing:
  sign-gap: "12px"
  gutter: "clamp(16px, 4vw, 56px)"
  section: "clamp(64px, 9vw, 120px)"
  section-lg: "clamp(72px, 10vw, 136px)"
  container: "1320px"
  container-narrow: "1120px"
components:
  sign-guide:
    backgroundColor: "{colors.guide}"
    textColor: "{colors.legend}"
    rounded: "{rounded.sign}"
    padding: "clamp(28px, 4vw, 56px) clamp(24px, 4.4vw, 64px)"
  exit-panel:
    backgroundColor: "{colors.legend}"
    textColor: "{colors.guide-deep}"
    typography: "{typography.sign-legend}"
    rounded: "{rounded.panel}"
    padding: "20px 22px 20px 26px"
  exit-panel-hover:
    backgroundColor: "{colors.exit-hover}"
    textColor: "{colors.guide-deep}"
  flag-sign-negotiate:
    backgroundColor: "{colors.legend}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.flag-type}"
    rounded: "{rounded.panel}"
    padding: "12px 14px 14px"
  flag-sign-negotiate-tier:
    backgroundColor: "{colors.regulatory}"
    textColor: "{colors.legend}"
    typography: "{typography.tier}"
    padding: "6px 14px 5px"
  flag-sign-know:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.flag-type}"
    rounded: "{rounded.panel}"
    padding: "12px 14px 14px"
  flag-sign-outside:
    backgroundColor: "{colors.construction}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.flag-type}"
    rounded: "{rounded.panel}"
    padding: "12px 14px 14px"
  citation-lit:
    backgroundColor: "{colors.marking}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.document}"
    rounded: "{rounded.cite}"
    padding: "0.05em 0.1em"
  citation-outside-lit:
    backgroundColor: "{colors.construction}"
    textColor: "{colors.sign-ink}"
    typography: "{typography.document}"
    rounded: "{rounded.cite}"
    padding: "0.05em 0.1em"
  distance-marker:
    backgroundColor: "{colors.guide}"
    textColor: "{colors.legend}"
    rounded: "{rounded.plate}"
    padding: "8px 14px 6px"
  plate:
    backgroundColor: "{colors.legend}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.plate}"
    padding: "18px 22px"
  strip-plate:
    backgroundColor: "{colors.legend}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.tag}"
    padding: "3px 12px 2px"
---

<!-- Recorded from the shipped landing build (landing/index.html, styles.css, app.js); finish review disposition: ship, 2026-10-05. The app shell is not built: anything marked "Intended (shell brief)" comes from .impeccable/surfaces/app-app-layout-tsx.md and is not shipped. -->

# Design System: Redline

## Overview

**Creative North Star: "Exit Ahead"**

Redline is signed like an interstate. Guide-green panels with an inset white border and rounded corners own the frame; the contract runs underneath on asphalt; each flag is a sign hung over the road, pointing at the exact sentence it came from, and that sentence carries a road-marking highlight. Colour is never decoration here: every sign colour is a traffic meaning, and the meanings are fixed (red-and-white regulatory for *Negotiate before signing*, yellow warning for *Know before signing*, orange construction for an outside-terms notice).

Two voices share the page. Highway lettering (Overpass, heavy weights, tabular figures) sets every sign, label and interface word. A document serif (Source Serif 4) sets the contract's own sentences, so the reader can always tell Redline's voice from the document's. Density is comfortable and desk-first; signs are compact and legible at a glance, the contract is set long and loose (1.7 line height) for checking word by word.

Depth is physical but quiet: signs hang from steel beams and brackets and cast a soft drop shadow; borders are painted on as inset rings, the way a real sign's border is printed inside its edge. The one signature move is the lit sign: signs sit dim until their cited sentence crosses the reading line, then light with a retroreflective sweep and rank themselves by tier, then by money.

**Key Characteristics:**
- Guide-green sign panels with an inset legend-white ring and 14px corners frame the page.
- Tier colours carry fixed traffic meanings and are never used decoratively.
- Overpass for every sign and interface word; Source Serif 4 only for the document's text.
- Citations are marked with a road-marking yellow highlight that wipes in when the sentence is reached.
- Soft drop shadows under hanging signs; borders are inset rings, never CSS strokes.
- Signs light (dim to full, retroreflective sweep) and re-rank as their sentence is read; reduced motion shows every sign lit.

## Colors

A signage palette: saturated, flat, high-contrast sign faces over neutral road and sky grounds.

### Primary
- **Interstate Guide Green** (`guide`): the frame. Hero gantry, the trust-check sign, the closing sign, and the notice-obligation distance marker. Always carries legend-white text and the inset white ring.
- **Deep Guide Green** (`guide-deep`): the exit panel's legend and its inset ring; the green used when text sits on white.

### Secondary (tier colours, fixed meanings)
- **Regulatory Red** (`regulatory`): *Negotiate before signing* only. Appears as the 5px inset ring of a white flag sign, the tier bar under it, and the note swatch.
- **Warning Yellow** (`warning`): *Know before signing* only. The face of a warning flag sign and its note swatch.
- **Construction Orange** (`construction`): outside-terms notices only. The face of the outside-terms sign, its note swatch, and its citation highlight.

### Tertiary
- **Road-Marking Yellow** (`marking`): the highlight on a lit citation, the keyboard focus ring (3px), text selection, the active-sign halo, the solid left edge line, and the skip link. Deliberately distinct from Warning Yellow: marking is "this is where to look", warning is a tier.

### Neutral
- **Legend White** (`legend`): sign legends, white sign faces (regulatory flags, plates, exit panel, strip plate) and every inset sign ring.
- **Soft Legend** (`legend-soft`): lede and secondary copy on guide green.
- **Sign Ink** (`sign-ink`): text and black rings on white, yellow and orange sign faces; text on a lit citation.
- **Asphalt** (`asphalt`): the ground under the contract, the sticky sign strip and the footer.
- **Road Text** (`road-text`) and **Road Dim** (`road-dim`): contract text and notes on asphalt; clause numbers, contract section heads and synthetic-sample notes on asphalt.
- **Lane White** (`lane`): the dashed right edge line on the road.
- **Overcast Sky** (`sky`) and **Sky Ink** (`sky-ink`): page ground and body text outside the road (the limits section).
- **Gantry Steel** (`steel`, `steel-dark`): beams, brackets and the sign post, always as a two-tone metal gradient.
- **Exit Sub** (`exit-sub`), **Exit Hover** (`exit-hover`), **Plate Text** (`plate-text`): the exit panel's sub-legend, its hover face, and secondary text on regulatory plates.

### Named Rules
**The Fixed Meaning Rule.** Red-and-white means *Negotiate before signing*, yellow means *Know before signing*, orange means an outside-terms notice, green is the frame. A tier colour never appears where its meaning does not apply, and a meaning never borrows another tier's colour. Intended (shell brief): green also marks a clean result.

**The Marking Is Not Warning Rule.** Road-Marking Yellow points at a place (citation, focus, selection, active sign). Warning Yellow is a tier. Never swap them.

## Typography

**Display Font:** Overpass (with Helvetica Neue, Arial), self-hosted variable woff2, weights 100-900.
**Body Font:** Overpass, with tabular figures on by default.
**Document Font:** Source Serif 4 (with Georgia), self-hosted variable woff2, weights 200-900.

**Character:** Highway lettering for everything Redline says; a sober book serif for everything the contract says. The contrast is the citation made visible.

### Hierarchy
- **Display** (700, `clamp(2.3rem, 4.4vw, 3.6rem)`, 1.08): the hero headline on the gantry only, max 32ch.
- **Headline** (700, `clamp(1.9rem, 3.6vw, 3.25rem)`, 1.08): section headings on guide signs and the limits section, max 22ch where set.
- **Title** (700, `clamp(1.4rem, 2vw, 1.75rem)`, 1.08): headings on the road above the contract.
- **Sign Legend** (800, `clamp(1.3rem, 1.7vw, 1.6rem)`, 1.1): the exit panel's main legend. Wordmark (800, 1.5rem), plate titles (800, 1.2rem), distance-marker date (800, 1.35rem) sit in the same heavy register.
- **Flag Type** (700, 1.1rem, 1.15): the clause type on a flag sign; exposure beneath at 600, 0.92rem.
- **Body** (400, 1.0625rem, 1.5, tabular figures): interface copy; 1rem under 640px.
- **Document** (Source Serif 4, 400, 1.16rem, 1.7): contract sentences and citations; 1.08rem under 640px. Unflagged clauses run to 72ch; flagged clauses sit in a 38rem column beside their note.
- **Document Title** (Source Serif 4, 600, 1.3rem): the contract's own title.
- **Label** (Overpass 800, 0.95rem, 0.05em, uppercase): the contract's own section headings ("1. Term and renewal"), which are real document structure. The distance marker's "Notice by" (0.75rem) uses the same register as part of the sign.
- **Tier** (700, 0.8rem, 1.2): the tier bar at the foot of a flag sign, in sentence case.

### Named Rules
**The Two Voices Rule.** Source Serif 4 sets only the document's own sentences and its title. Everything Redline says, including clause numbers and the contract's navigational section heads, is Overpass.

**The Heavy Legend Rule.** Sign legends use 700-800 weight; nothing on a sign face is set lighter than 600.

## Layout

Full-bleed bands stacked as a drive: green gantry, asphalt road with the contract, guide sign, sky ground with a sign post, closing guide sign, asphalt footer. Side gutter is fluid (`gutter`); content containers cap at 1320px (gantry, sign strip, road) and 1120px (check, limits, close sign). Vertical rhythm between bands uses `section` and `section-lg`.

- **Sign strip:** six flag signs in a six-column grid with a 12px gap, sticky at the top of the road under a steel beam; three columns at 1100px or less; a horizontal scroll-snap row (each sign 62% wide) at 640px or less.
- **Clause grid:** a flagged clause is two columns, the document sentence (max 38rem) and its note, gap `clamp(24px, 4vw, 64px)`, separated by a 1px road-text rule at 28% opacity. Below 860px the note stacks under the sentence.
- **Hero gantry:** a grid with nav across the top (separated by a 2px white rule at 35%), headline, then lede and exit panel side by side, bottom-aligned; one column below 860px with the exit panel stretched full width.
- **Limits:** two columns (0.9fr / 1.1fr) with sticky copy and a post of stacked plates; one column below 860px.
- **Road edge lines:** solid marking-yellow at left, dashed lane-white at right (46px dash, 46px gap), 6px wide (4px on phones), centred in the gutter.
- Breakpoints: 1100px, 860px, 640px.

**Accepted deviations (finish review, 2026-10-05).** The one-sentence contract preamble runs to 90ch, against 72ch for other unflagged clauses, so the first cited sentence sits above the fold at 1440x900. The first-viewport promise (gantry plus first marked sentence) is not met at 1280x800. Both are recorded deviations, not rules: new surfaces use the 72ch measure.

## Elevation & Depth

Hybrid and physical. Signs hang, so they cast soft, offset-down drop shadows with a negative spread (never a hard offset block); the sticky strip casts a long dark shadow onto the road. Sign borders are inset `box-shadow` rings painted inside the face. Nothing floats without a reason to hang.

### Shadow Vocabulary
- **Hanging sign** (`0 18px 36px -18px rgba(10, 30, 20, 0.55)`): under guide-green signs.
- **Exit panel** (`0 10px 22px -12px rgba(0, 0, 0, 0.6)`; hover `0 16px 28px -14px rgba(0, 0, 0, 0.65)`): the primary action.
- **Plate** (`0 10px 20px -14px rgba(0, 0, 0, 0.5)`): regulatory plates on the post.
- **Strip** (`0 14px 24px -18px rgba(0, 0, 0, 0.9)`): the sticky sign strip over the road.
- **Beam** (`0 6px 10px -6px rgba(0, 0, 0, 0.35)`): gantry beams.

### Named Rules
**The Inset Border Rule.** A sign's border is an inset ring in its own legend colour, separated from the edge by the face colour: guide signs 6px face then 3px white; warning and construction signs 3px ink then 2px face; plates 3px ink then 3px white; regulatory flags a 5px red ring on white. Never a CSS border stroke.

## Shapes

Rounded rectangles only, scaled by sign size: 14px for large guide signs, 10px for flag signs and the exit panel, 8px for plates and the distance marker, 4px for the small strip plate and the focus ring, 2px for citation highlights, 3px for note swatches. Steel is the only other form: beams (16px, two-tone hard-stop gradient), 12px brackets from beam to sign, and a 14px round-edged post.

## Components

### Exit Panel (primary action)
Tactile and unmistakable: a white exit sign on green.
- **Shape:** 10px corners, min width 300px (full width below 860px).
- **Default:** legend-white face, deep-green 3px inset ring and text, two-line legend (Sign Legend, then a 600 sub-legend in `exit-sub`), a 46px diagonal arrow drawn in SVG at right.
- **Hover:** lifts 2px, face to `exit-hover`, deeper shadow, arrow nudges 3px up-right (0.35s, `ease-out`). **Active:** returns to rest. **Focus:** global 3px marking-yellow ring, 3px offset.

### Flag Sign (signature)
A small sign in the strip, one per flag or outside-terms notice, ranked.
- **Anatomy:** clause type (Flag Type), exposure (600, 0.92rem), tier bar bleeding to the sign's edges at the foot.
- **Negotiate before signing:** white face, 5px regulatory ring, red tier bar with white text.
- **Know before signing:** warning-yellow face, ink and yellow rings, tier bar ruled with a 3px ink line.
- **Outside terms:** construction-orange face, same ring and bar treatment as warning.
- **States:** dim at rest (`brightness(0.55) saturate(0.75)`); lit when its citation is read, with a white retroreflective sweep (0.9s). Hover lifts 2px; active lifts 3px and gains a 3px marking-yellow halo. Selecting a sign scrolls to its citation and focuses it. Signs re-order with a 650ms FLIP animation, tier first, then money. Reduced motion: all lit, no sweep, no transitions.

### Citation Highlight
- **Style:** document serif text; a marking-yellow background wipes left to right (0.8s) when lit, text turns sign-ink; highlights clone across line breaks. Outside-terms citations wipe in construction orange.
- **Active:** 3px legend-white outline, 3px offset.

### Flag Note
- **Style:** beside the citation, a 1px left rule; title at 800 with a 14px tier swatch (3px radius) in the tier's colour; explanation; counter-offer with its label in road-text 700 and the wording in road-dim.

### Distance Marker (notice obligation)
- **Style:** a small guide-green sign (8px, inset 3px face then 2px white ring) with an uppercase "Notice by" label and the date at 800, 1.35rem. Sits in the flag note.

### Regulatory Plate
- **Style:** white plate, 8px corners, ink-and-white inset ring, title 800 1.2rem, body 1rem in `plate-text`; stacked 14px apart on a single steel post.

### Navigation
- **Style:** inside the hero gantry: route-shield wordmark (SVG shield, 800 1.5rem) at left, links at 600 1rem at right, underline on hover; wraps below 640px.

### Strip Plate
- **Style:** a small white tag with a 2px ink ring, centred on the strip's beam, labelling the sample contract as made up (700, 0.78rem).

### Intended, not shipped (shell brief)
The app shell is unbuilt. Its brief says the Operate frame takes only type, palette, density and one move from this world: Overpass for interface and Source Serif 4 for contract text and citations; guide green for the navigation rail; the tier colours with the meanings above, plus green for a clean result; the document read on a light ground; flags as sign panels in a sticky strip over the document, selecting one scrolls to its citation with the marking highlight; notice obligations as distance markers in the margin; standard web layout, navigation and controls. No input, table or light-ground document component exists yet, so none is specified here.

## Do's and Don'ts

### Do:
- **Do** give every sign panel its border as an inset ring (The Inset Border Rule), with 14px, 10px or 8px corners by size.
- **Do** keep tier colours to their fixed meanings: regulatory red for *Negotiate before signing*, warning yellow for *Know before signing*, construction orange for outside-terms notices.
- **Do** set the document's sentences in Source Serif 4 at 1.7 line height and a 72ch measure, and everything else in Overpass.
- **Do** mark a citation with the road-marking highlight and keep the 3px marking-yellow focus ring on every interactive element.
- **Do** show every sign lit and skip the sweep and transitions under reduced motion.
- **Do** use tabular figures for money, dates and counts.

### Don't:
- **Don't** use a tier colour for decoration, emphasis or branding.
- **Don't** swap Road-Marking Yellow and Warning Yellow.
- **Don't** set Redline's own words in the document serif, or the document's sentences in Overpass.
- **Don't** draw sign borders as CSS strokes or give signs a hard, unblurred offset shadow.
- **Don't** use a numeric score or a high/medium/low scale in place of a tier sign.
- **Don't** (intended, shell brief) carry the road costume onto working screens: no asphalt ground, lane or edge lines, or gantry steel in the Operate frame. These remain native to the landing world.
