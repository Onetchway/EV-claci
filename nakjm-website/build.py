#!/usr/bin/env python3
"""Emit the five static NAKJM pages with a shared shell."""
import os

OUT = "/home/user/EV-claci/nakjm-website"

PHONE = "+91 99715 35940"
TEL = "+919971535940"
EMAIL = "connect@nakjiminfra.com"
PORTAL = "www.nakjiminfra.com"
ADDR_HTML = ("CoWynd Managed Office, First Floor,<br>Plot 103, Dwarka Sector 19,<br>"
             "New Delhi &mdash; 110075")

NAV = [("index.html", "Home"), ("capabilities.html", "Capabilities"),
       ("projects.html", "Projects"), ("about.html", "Our Company"),
       ("contact.html", "Contact")]

SITE = "https://www.nakjiminfra.com"

# Organization schema, emitted once on the homepage so search engines can
# resolve the company, its address and its contact point.
ORG_JSONLD = """{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "NAKJM Infrastructure Pvt Ltd",
  "alternateName": "NAKJM Infrastructure",
  "description": "Next-generation EPC company delivering turnkey civil, electrical and EV charging infrastructure across India with 100%% in-house execution.",
  "url": "%s/",
  "logo": "%s/assets/logo.png",
  "slogan": "Building Tomorrow, Together.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "CoWynd Managed Office, First Floor, Plot 103, Dwarka Sector 19",
    "addressLocality": "New Delhi",
    "addressRegion": "Delhi",
    "postalCode": "110075",
    "addressCountry": "IN"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "%s",
    "email": "%s",
    "contactType": "sales",
    "areaServed": "IN"
  },
  "knowsAbout": [
    "EPC contracting", "EV charging infrastructure", "HT/LT electrical works",
    "Civil and structural construction", "MS fabrication", "Grid integration"
  ]
}""" % (SITE, SITE, PHONE, EMAIL)


def head(title, desc, page, jsonld=None):
    links = "\n".join(
        '        <li><a href="%s"%s>%s</a></li>' %
        (h, ' aria-current="page"' if h == page else "", t) for h, t in NAV)
    canonical = SITE + "/" + ("" if page == "index.html" else page)
    og_img = SITE + "/assets/img/hub-electriva.jpg"
    schema = ('\n<script type="application/ld+json">\n%s\n</script>' % jsonld) if jsonld else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NAKJM Infrastructure">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_img}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{og_img}">
<meta name="theme-color" content="#001E4B">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add("js");</script>
<link rel="stylesheet" href="assets/styles.css">{schema}
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>

<div class="utility">
  <div class="wrap">
    <a href="tel:{TEL}">{PHONE}</a>
    <span class="utility__sep" aria-hidden="true">|</span>
    <a href="mailto:{EMAIL}">{EMAIL}</a>
    <span class="utility__sep" aria-hidden="true">|</span>
    <a href="contact.html">Request a Site Survey</a>
  </div>
</div>

<header class="nav">
  <div class="wrap">
    <a class="nav__logo" href="index.html" aria-label="NAKJM Infrastructure home">
      <img src="assets/logo.png" alt="NAKJM Infrastructure" width="172" height="53">
    </a>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Toggle navigation">
      <span></span>
    </button>
    <nav class="nav__menu" id="nav-menu" aria-label="Primary">
      <ul class="nav__list">
{links}
      </ul>
      <div class="nav__cta">
        <a class="btn btn--primary" href="contact.html">Commission a project <span class="btn__arrow">&rarr;</span></a>
      </div>
    </nav>
  </div>
</header>

<main id="main">
"""


FOOTER = f"""
</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div class="footer__brand">
        <img src="assets/logo-light.png" alt="NAKJM Infrastructure" width="196" height="61">
        <p>
          NAKJM Infrastructure Pvt Ltd &mdash; next-generation mega-builders.
          Turnkey civil, electrical and EV charging infrastructure, executed
          entirely in-house.
        </p>
      </div>
      <div>
        <h4>Capabilities</h4>
        <ul>
          <li><a href="capabilities.html#foundation">Civil &amp; Structural</a></li>
          <li><a href="capabilities.html#power">Electrical Engineering</a></li>
          <li><a href="capabilities.html#application">EV Infrastructure</a></li>
          <li><a href="capabilities.html#networks">Charging Networks</a></li>
          <li><a href="capabilities.html#safety">O&amp;M and AMC</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About NAKJM</a></li>
          <li><a href="about.html#mission">Mission &amp; Vision</a></li>
          <li><a href="about.html#footprint">Operating Footprint</a></li>
          <li><a href="projects.html">Projects</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Get in touch</h4>
        <ul>
          <li><a href="tel:{TEL}">{PHONE}</a></li>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li>{ADDR_HTML}</li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <span>&copy; <span data-year>2026</span> NAKJM Infrastructure Pvt Ltd. All rights reserved.</span>
      <span>Building Tomorrow, Together.</span>
    </div>
  </div>
</footer>

<script src="assets/script.js"></script>
</body>
</html>
"""

CTA = """
  <section class="cta">
    <div class="cta__bg">
      <img src="assets/img/hub-electriva.jpg" alt="" aria-hidden="true" loading="lazy">
    </div>
    <div class="wrap">
      <div class="cta__inner">
        <span class="eyebrow">Start a project</span>
        <h2>Building the <span class="accent">new energy era.</span></h2>
        <p>
          Send us the site, the sanctioned load and the timeline. We come back
          with a feasibility view and a single-contract delivery plan &mdash;
          civil, electrical and charging under one accountable team.
        </p>
        <div class="cta__actions">
          <a class="btn btn--primary" href="contact.html">Commission a project <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost-light" href="tel:%s">%s</a>
        </div>
      </div>
    </div>
  </section>
""" % (TEL, PHONE)

FLOW_STEPS = [
    ("01", "Site Survey", "Feasibility &amp; load assessment"),
    ("02", "Design", "Electrical &amp; civil engineering"),
    ("03", "Civil Foundation", "Earthworks &amp; trenching"),
    ("04", "Electrical Installation", "HT/LT works"),
    ("05", "Transformer &amp; RMU", "Grid integration"),
    ("06", "Charger Installation", "Hardware-agnostic deployment"),
    ("07", "Testing", "Safety &amp; diagnostics"),
    ("08", "Commissioning", "Handover"),
    ("09", "AMC", "Preventive maintenance &amp; O&amp;M"),
]

FLOW_RAIL = "\n".join(
    '        <li class="step"><span class="step__no">%s</span><h4>%s</h4><p>%s</p></li>' % s
    for s in FLOW_STEPS)

SAFETY_CARDS = """
      <div class="grid grid--2 reveal">
        <article class="card">
          <h3>Electrical diagnostic testing</h3>
          <p>
            Rigorous pre-commissioning protocols including thermal testing,
            insulation testing and exact earth-resistance testing to guarantee
            zero-fault grid integration.
          </p>
        </article>
        <article class="card">
          <h3>Quality assurance</h3>
          <p>
            Multi-tier inspection regime ensuring exact OEM hardware
            compatibility, structural integrity of MS fabrications and precise
            levelling of civil pads.
          </p>
        </article>
        <article class="card">
          <h3>Preventive maintenance &amp; AMC</h3>
          <p>
            24/7 lifecycle management, rapid-response outstation maintenance and
            routine physical infrastructure audits to maximise uptime.
          </p>
        </article>
        <article class="card">
          <h3>Site safety &amp; compliance</h3>
          <p>
            Strict adherence to national electrical fire safety codes, mandatory
            100% PPE compliance for all on-site personnel and continuous hazard
            mitigation.
          </p>
        </article>
      </div>
"""

CLIENTS = [("tesla", "Tesla"), ("vinfast", "VinFast"), ("mg", "MG"),
           ("tata", "Tata Passenger Electric Mobility"), ("jiobp", "Jio-bp"),
           ("adani", "Adani TotalEnergies"), ("electriva", "Electriva"),
           ("terra", "Terra Charge"), ("exicom", "Exicom"),
           ("xpulse", "XPulse EV Charging"), ("vgreen", "V-Green"),
           ("chargze", "ChargZe")]

TRUST = "\n".join(
    '        <li class="trust__item">'
    '<img src="assets/img/clients/%s.png" alt="%s" loading="lazy" width="180" height="46">'
    '</li>' % (f, n) for f, n in CLIENTS)


def quicklinks(label, items):
    li = "\n".join('          <li><a href="%s">%s</a></li>' % (h, t) for h, t in items)
    return f"""
  <div class="quicklinks">
    <div class="wrap">
      <div class="quicklinks__inner">
        <span class="quicklinks__label">{label}</span>
        <ul class="quicklinks__list">
{li}
        </ul>
      </div>
    </div>
  </div>
"""


def hero(img, alt, eyebrow, h1, lede, actions="", extra="", short=False):
    return f"""
  <section class="hero{' hero--short' if short else ''}">
    <div class="hero__bg">
      <img src="assets/img/{img}" alt="{alt}" loading="eager">
    </div>
    <div class="wrap">
      <div class="hero__inner">
        <span class="eyebrow">{eyebrow}</span>
        <h1>{h1}</h1>
        <p class="lede">{lede}</p>
        {actions}
        {extra}
      </div>
    </div>
  </section>
"""


# --------------------------------------------------------------------------
# index
# --------------------------------------------------------------------------

index = head(
    "NAKJM Infrastructure — Total EPC Solutions for National Infrastructure",
    "NAKJM Infrastructure Pvt Ltd is a next-generation EPC company delivering "
    "turnkey civil, electrical and EV charging infrastructure across India with "
    "100% in-house execution.",
    "index.html", jsonld=ORG_JSONLD)

index += hero(
    "hero.jpg",
    "EV charging units installed on a landscaped forecourt built by NAKJM",
    "NAKJM Infrastructure Pvt Ltd",
    'Building Tomorrow,<br><span class="accent">Together.</span>',
    "Total EPC solutions for the next generation of national infrastructure "
    "&mdash; civil, electrical and EV charging delivered by one accountable "
    "team, with the precision of a technology deployment.",
    actions="""<div class="hero__actions">
          <a class="btn btn--primary" href="capabilities.html">Explore capabilities <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost-light" href="projects.html">View our projects</a>
        </div>""",
    extra="""<div class="hero__tags">
          <span class="tag">Civil Construction</span>
          <span class="tag">Electrical Engineering</span>
          <span class="tag">EV Networks</span>
        </div>""")

index += """
  <div class="hero__stats">
    <div class="wrap">
      <ul>
        <li><div class="n" data-count-to="15" data-suffix="+">15+</div><div class="t">Years total EPC experience</div></li>
        <li><div class="n" data-count-to="7" data-suffix="+">7+</div><div class="t">Years EV charging expertise</div></li>
        <li><div class="n" data-count-to="300" data-suffix="+">300+</div><div class="t">EV stations delivered</div></li>
        <li><div class="n" data-count-to="15" data-suffix="+">15+</div><div class="t">Large EV charging hubs</div></li>
      </ul>
    </div>
  </div>
"""

index += quicklinks("Quick links", [
    ("capabilities.html#foundation", "Civil &amp; Structural"),
    ("capabilities.html#power", "Electrical Engineering"),
    ("capabilities.html#application", "EV Infrastructure"),
    ("capabilities.html#networks", "Charging Networks"),
    ("capabilities.html#safety", "Safety &amp; QA"),
    ("projects.html", "Projects"),
])

index += """
  <!-- problem / solution -->
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Why we exist</span>
        <h2>Nationwide rollouts break on <span class="accent">fragmented delivery.</span></h2>
        <p class="lede">
          EV and energy networks are being built at unprecedented scale. The
          contracting model underneath them has not kept pace.
        </p>
      </div>

      <div class="grid grid--2 reveal" style="margin-bottom:2.5rem">
        <article class="card">
          <h3>The bottleneck</h3>
          <p>
            Traditional reliance on fragmented contractors &mdash; separate
            civil, electrical and fabrication vendors &mdash; causes misaligned
            timelines, blown budgets and vendor-dependency risk.
          </p>
          <p style="margin-top:1rem">
            <strong style="color:var(--navy-800)">Mega-scale demand.</strong>
            Nationwide EV and energy network rollouts are accelerating at an
            unprecedented scale, requiring massive physical footprints.
          </p>
        </article>
        <article class="card" style="border-top-color:var(--red-600)">
          <h3>The NAKJM solution</h3>
          <p>
            A next-generation infrastructure company delivering turnkey, 100%
            in-house execution with the precision of a tech deployment.
          </p>
          <p style="margin-top:1rem">
            One central command owns the site from feasibility through
            commissioning and long-term maintenance &mdash; so there is never a
            gap between trades to fall into.
          </p>
          <p style="margin-top:1.25rem"><a class="link-more" href="about.html">How we are structured</a></p>
        </article>
      </div>

      <div class="table-scroll reveal">
        <table class="compare">
          <caption class="sr-only">Traditional fragmented contractors compared with the NAKJM next-generation EPC model</caption>
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Criterion</span></th>
              <th scope="col">Traditional fragmented contractors</th>
              <th scope="col">The NAKJM next-gen EPC</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Vendor dependency</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Fragmented across 4+ vendors</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>100% unified in-house execution</td>
            </tr>
            <tr>
              <th scope="row">Fabrication speed</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Outsourced with variable delays</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>In-house MS fabrication facility for fast-tracking</td>
            </tr>
            <tr>
              <th scope="row">Technical integration</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Basic standard wiring</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>4+ years deep expertise in hardware-agnostic EV integration</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>One partner. End-to-end.</strong><span>From civil to commissioning.</span></li>
        <li><strong>Faster. Smarter. Reliable.</strong><span>Built for scale and speed.</span></li>
        <li><strong>Lower risk. Higher control.</strong><span>Complete visibility. Zero silos.</span></li>
      </ul>
    </div>
  </section>

  <!-- the stack -->
  <section class="section section--paper">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">The NAKJM stack</span>
        <h2>An integrated infrastructure <span class="accent">operating system.</span></h2>
        <p class="lede">
          Three pillars, one contract, one accountable team &mdash; from the
          ground up to the grid connection.
        </p>
      </div>

      <div class="reveal">
        <article class="numblock">
          <div class="numblock__no">01</div>
          <div>
            <h3>Foundation &mdash; Civil &amp; Structural</h3>
            <p>
              Heavy construction, massive floorplates and precision groundwork,
              backed by our own MS fabrication facility for structural steel and
              canopies.
            </p>
            <p style="margin-top:1rem"><a class="link-more" href="capabilities.html#foundation">Civil capabilities</a></p>
          </div>
        </article>
        <article class="numblock">
          <div class="numblock__no">02</div>
          <div>
            <h3>Power &mdash; Electrical Engineering</h3>
            <p>
              High-capacity HT/LT electrical works, custom panel installation,
              DISCOM coordination and grid auditing &mdash; taken all the way to
              a live, compliant connection.
            </p>
            <p style="margin-top:1rem"><a class="link-more" href="capabilities.html#power">Electrical capabilities</a></p>
          </div>
        </article>
        <article class="numblock">
          <div class="numblock__no">03</div>
          <div>
            <h3>Application &mdash; EV Infrastructure</h3>
            <p>
              Hardware-agnostic fast-charging hubs deployed from site survey to
              full grid commissioning, integrating any tier-1 OEM equipment.
            </p>
            <p style="margin-top:1rem"><a class="link-more" href="capabilities.html#application">EV capabilities</a></p>
          </div>
        </article>
      </div>

      <ul class="assure reveal" style="margin-top:3rem">
        <li><strong>One stack.</strong><span>End-to-end integration across civil, electrical and EV.</span></li>
        <li><strong>Seamless execution.</strong><span>Unified teams and processes for speed and consistency.</span></li>
        <li><strong>Scalable impact.</strong><span>Built to scale for today's demand and tomorrow's.</span></li>
      </ul>
    </div>
  </section>

  <!-- charging solutions strip -->
  <section class="strip strip--navy">
    <div class="strip__media">
      <img src="assets/img/hub-xpulse.jpg" alt="XPulse heavy-duty fleet charging hub at Samalkha, Haryana" loading="lazy">
    </div>
    <div class="strip__copy">
      <span class="eyebrow">Smart charging solutions</span>
      <h2>From a single home charger to a <span class="accent">highway megahub.</span></h2>
      <p style="margin-bottom:1.75rem">
        Two product families, one delivery standard. We size, build and
        commission both.
      </p>
      <h4 style="color:#fff;margin-bottom:0.35rem">Low-voltage &amp; distributed networks</h4>
      <div class="chips">
        <span class="chip">7.4 kW</span><span class="chip">11 kW</span><span class="chip">22 kW</span>
      </div>
      <h4 style="color:#fff;margin-bottom:0.35rem">High-voltage &amp; hub deployment</h4>
      <div class="chips">
        <span class="chip chip--red">30 kW</span><span class="chip chip--red">60 kW</span>
        <span class="chip chip--red">120 kW</span><span class="chip chip--red">180 kW</span>
        <span class="chip chip--red">240 kW</span>
      </div>
      <p style="margin-top:0.5rem"><a class="link-more" href="capabilities.html#networks">All charging networks</a></p>
    </div>
  </section>

  <!-- proof of scale -->
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Project execution</span>
        <h2>Mega-scale EV hubs &amp; <span class="accent">highway charging.</span></h2>
        <p class="lede">Delivering future-ready charging infrastructure at scale.</p>
      </div>
      <div class="grid grid--2 reveal">
        <a class="tile" href="projects.html" style="aspect-ratio:16/10">
          <img src="assets/img/hub-electriva.jpg" alt="Electriva multi-vehicle highway charging hub in Delhi NCR at dusk" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Delhi NCR</span>
            <h3>Electriva &mdash; multi-vehicle highway charging hub</h3>
            <p>Canopied corridor hub on precision civil pads with underground HT routing.</p>
            <span class="tile__stat">120+ chargers &middot; AC &amp; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="projects.html" style="aspect-ratio:16/10">
          <img src="assets/img/hub-vinfast.jpg" alt="VinFast OEM delivery hub and commercial fleet depot" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">OEM delivery hub</span>
            <h3>VinFast &mdash; commercial fleet depot</h3>
            <p>High-density charger array sized for OEM delivery and fleet duty cycles.</p>
            <span class="tile__stat">60+ chargers &middot; AC &amp; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="projects.html" style="aspect-ratio:16/10">
          <img src="assets/img/hub-xpulse.jpg" alt="XPulse heavy-duty fleet charging hub at Samalkha, Haryana" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Samalkha, Haryana</span>
            <h3>XPulse &mdash; heavy-duty fleet charging hub</h3>
            <p>Corridor hub for heavy commercial vehicles on continuous duty cycles.</p>
            <span class="tile__stat">70+ chargers &middot; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="projects.html" style="aspect-ratio:16/10">
          <img src="assets/img/hub-tesla.jpg" alt="Tesla Supercharger station in Gurgaon, Haryana" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Gurgaon, Haryana</span>
            <h3>Tesla &mdash; Supercharger station</h3>
            <p>Full civil, electrical and mounting works to Supercharger specification.</p>
            <span class="tile__stat">16 Superchargers &middot; 250 kW DC</span>
          </div>
        </a>
      </div>
      <p style="margin-top:2.5rem"><a class="btn btn--outline" href="projects.html">View all projects <span class="btn__arrow">&rarr;</span></a></p>
    </div>
  </section>

  <!-- execution flow -->
  <section class="section section--paper">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Lifecycle</span>
        <h2>End-to-end <span class="accent">execution flow.</span></h2>
        <p class="lede">One partner. One process. Complete peace of mind.</p>
      </div>
      <ol class="rail reveal">
""" + FLOW_RAIL + """
      </ol>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Single point responsibility</strong><span>From concept to commissioning and beyond.</span></li>
        <li><strong>Standardised processes</strong><span>Proven workflows ensuring quality, safety &amp; compliance.</span></li>
        <li><strong>Faster execution</strong><span>In-house capabilities for speed and agility.</span></li>
        <li><strong>Long-term reliability</strong><span>Built for performance, supported for life.</span></li>
      </ul>
    </div>
  </section>

  <!-- clients -->
  <section class="section">
    <div class="wrap">
      <div class="section-head section-head--center">
        <span class="eyebrow">Trusted by the tier-1 mobility ecosystem</span>
        <h2>Seamless execution across <span class="accent">OEMs and CPOs.</span></h2>
        <p class="lede">
          Seamless execution across all major EV original equipment
          manufacturers and charge point operators.
        </p>
      </div>
      <ul class="trust__grid reveal">
""" + TRUST + """
      </ul>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Trusted partnerships</strong><span>Strong collaborations with industry leaders.</span></li>
        <li><strong>Seamless integration</strong><span>Compatible with leading OEM and CPO platforms.</span></li>
        <li><strong>Future ready</strong><span>Building a robust ecosystem for sustainable mobility.</span></li>
      </ul>
    </div>
  </section>

  <!-- safety -->
  <section class="section section--navy" id="safety">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Assurance</span>
        <h2>Uncompromising safety &amp; <span class="accent">quality assurance.</span></h2>
        <p class="lede">
          Every site is signed off against the same protocols, whether it is one
          charger or a hundred.
        </p>
      </div>
""" + SAFETY_CARDS + """
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Zero compromise.</strong><span>On safety.</span></li>
        <li><strong>Built for reliability.</strong><span>Designed for durability.</span></li>
        <li><strong>Process driven.</strong><span>Performance assured.</span></li>
        <li><strong>Excellence in every step.</strong><span>Assurance in every outcome.</span></li>
      </ul>
    </div>
  </section>
"""

index += CTA + FOOTER

# --------------------------------------------------------------------------
# capabilities
# --------------------------------------------------------------------------

cap = head("Capabilities — NAKJM Infrastructure",
           "The NAKJM stack: civil and structural foundation, HT/LT electrical "
           "engineering and hardware-agnostic EV charging infrastructure, "
           "delivered end to end.",
           "capabilities.html")

cap += hero("panel.jpg", "Custom HT/LT panel engineered and wired by NAKJM",
            "Capabilities",
            'An integrated infrastructure <span class="accent">operating system.</span>',
            "Three pillars under one contract. We own the ground, the power and "
            "the application &mdash; so the site is never waiting on someone "
            "else's crew.",
            actions="""<div class="hero__actions">
          <a class="btn btn--primary" href="contact.html">Request a site survey <span class="btn__arrow">&rarr;</span></a>
        </div>""",
            short=True)

cap += quicklinks("On this page", [
    ("#foundation", "Foundation"), ("#power", "Power"),
    ("#application", "Application"), ("#networks", "Charging Networks"),
    ("#anatomy", "Anatomy of a Hub"), ("#flow", "Execution Flow"),
    ("#safety", "Safety &amp; QA"),
])

cap += """
  <!-- pillar 1 -->
  <section class="strip" id="foundation">
    <div class="strip__media">
      <img src="assets/img/factory.jpg" alt="Ten factory units under steel-frame construction at Bawana" loading="lazy">
    </div>
    <div class="strip__copy">
      <span class="eyebrow">Pillar 01</span>
      <h2>Foundation &mdash; <span class="accent">Civil &amp; Structural</span></h2>
      <p style="margin-bottom:1.5rem">
        Heavy construction, massive floorplates and precision groundwork. The
        physical substrate everything else depends on.
      </p>
      <ul class="checklist">
        <li><strong>Industrial &amp; commercial build-outs</strong> &mdash; massive floorplates delivered ground-up.</li>
        <li><strong>In-house MS structure &amp; canopy fabrication</strong> &mdash; dedicated manufacturing eliminating third-party delays.</li>
        <li><strong>Underground infrastructure</strong> &mdash; precision cable trenching and heavy earthworks.</li>
        <li><strong>Precision civil pads</strong> &mdash; levelling and high-strength concrete to hardware tolerances.</li>
      </ul>
    </div>
  </section>

  <!-- pillar 2 -->
  <section class="strip strip--flip strip--navy" id="power">
    <div class="strip__media">
      <img src="assets/img/transformer.jpg" alt="High-capacity transformer commissioned on a concrete plinth" loading="lazy">
    </div>
    <div class="strip__copy">
      <span class="eyebrow">Pillar 02</span>
      <h2>Power &mdash; <span class="accent">Electrical Engineering</span></h2>
      <p style="margin-bottom:1.5rem">
        High-capacity HT/LT electrical works, custom panel installation and grid
        auditing &mdash; taken all the way to a live, compliant connection.
      </p>
      <ul class="checklist">
        <li><strong>HT/LT systems &amp; RMU installation</strong> &mdash; end-to-end routing from incoming supply to final distribution.</li>
        <li><strong>DISCOM coordination &amp; load assessment</strong> &mdash; navigating grid connectivity and utility approvals.</li>
        <li><strong>Panel installation</strong> &mdash; custom HT/LT panels engineered for heavy, sustained loads.</li>
        <li><strong>Transformer commissioning</strong> &mdash; siting, plinths and energisation to national codes.</li>
      </ul>
    </div>
  </section>

  <!-- pillar 3 -->
  <section class="strip" id="application">
    <div class="strip__media">
      <img src="assets/img/dc-multibrand.jpg" alt="DC fast chargers from several manufacturers installed side by side" loading="lazy">
    </div>
    <div class="strip__copy">
      <span class="eyebrow">Pillar 03</span>
      <h2>Application &mdash; <span class="accent">EV Infrastructure</span></h2>
      <p style="margin-bottom:1.5rem">
        Hardware-agnostic fast-charging hubs deployed from site survey through to
        full grid commissioning. One platform, any hardware.
      </p>
      <ul class="checklist">
        <li><strong>Hardware agnosticism</strong> &mdash; flawless mounting and integration for any OEM hardware, AC or DC.</li>
        <li><strong>Site survey to commissioning</strong> &mdash; feasibility, build, test and handover under a single contract.</li>
        <li><strong>OEM &amp; CPO deployments</strong> &mdash; Tesla Supercharger integration and tier-1 CPO network rollouts.</li>
        <li><strong>Multi-state rollouts</strong> &mdash; repeatable station templates across outstation programmes.</li>
      </ul>
    </div>
  </section>

  <!-- networks -->
  <section class="section section--paper" id="networks">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Smart charging solutions</span>
        <h2>Charging networks for <span class="accent">every need.</span></h2>
      </div>
      <div class="grid grid--2 reveal">
        <article class="card">
          <h3>Low-voltage &amp; distributed networks</h3>
          <div class="chips">
            <span class="chip">7.4 kW</span><span class="chip">11 kW</span><span class="chip">22 kW</span>
          </div>
          <ul class="checklist">
            <li>Dedicated residential charging</li>
            <li>High-density apartment installations</li>
            <li>Luxury villa installations</li>
            <li>Smart home charging integration</li>
            <li>Direct OEM installations for MG &amp; VinFast</li>
          </ul>
        </article>
        <article class="card" style="border-top-color:var(--red-600)">
          <h3>High-voltage &amp; hub deployment</h3>
          <div class="chips">
            <span class="chip chip--red">30 kW</span><span class="chip chip--red">60 kW</span>
            <span class="chip chip--red">120 kW</span><span class="chip chip--red">180 kW</span>
            <span class="chip chip--red">240 kW</span>
          </div>
          <ul class="checklist">
            <li>Ultra-fast chargers</li>
            <li>Highway charging hubs</li>
            <li>Heavy fleet charging depots</li>
            <li>Public commercial infrastructure</li>
          </ul>
        </article>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Scalable solutions</strong><span>From home to highway.</span></li>
        <li><strong>Future-ready tech</strong><span>Built for performance.</span></li>
        <li><strong>Seamless integration</strong><span>Compatible with leading OEMs.</span></li>
        <li><strong>Reliable &amp; efficient</strong><span>Designed for long-term impact.</span></li>
      </ul>
    </div>
  </section>

  <!-- anatomy -->
  <section class="strip strip--flip strip--navy" id="anatomy">
    <div class="strip__media">
      <img src="assets/img/hub-anatomy.jpg" alt="Cutaway of a turnkey charging hub showing canopy, chargers, civil pads, transformer and underground cabling" loading="lazy">
    </div>
    <div class="strip__copy">
      <span class="eyebrow">Anatomy of a turnkey hub</span>
      <h2>Engineered. Integrated. <span class="accent">Built to perform.</span></h2>
      <p style="margin-bottom:2rem">
        Every hub we hand over is the sum of five engineered layers &mdash; each
        of them ours.
      </p>
      <ol class="anatomy">
        <li><span class="anatomy__no">1</span><div><h4>Hardware-agnostic units</h4><p>Flawless mounting for any OEM hardware (AC/DC).</p></div></li>
        <li><span class="anatomy__no">2</span><div><h4>In-house MS canopy</h4><p>Custom-fabricated overhead protection.</p></div></li>
        <li><span class="anatomy__no">3</span><div><h4>Precision civil pads</h4><p>Levelling, earthworks and high-strength concrete.</p></div></li>
        <li><span class="anatomy__no">4</span><div><h4>High-capacity transformers</h4><p>Safe, compliant electrical infrastructure.</p></div></li>
        <li><span class="anatomy__no">5</span><div><h4>Underground cable routing</h4><p>Safely trenched HT/LT wiring to the primary grid.</p></div></li>
      </ol>
    </div>
  </section>

  <!-- flow -->
  <section class="section" id="flow">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Lifecycle</span>
        <h2>End-to-end <span class="accent">execution flow.</span></h2>
        <p class="lede">One partner. One process. Complete peace of mind.</p>
      </div>
      <ol class="rail reveal">
""" + FLOW_RAIL + """
      </ol>
    </div>
  </section>

  <!-- safety -->
  <section class="section section--navy" id="safety">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Assurance</span>
        <h2>Uncompromising safety &amp; <span class="accent">quality assurance.</span></h2>
      </div>
""" + SAFETY_CARDS + """
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Zero compromise.</strong><span>On safety.</span></li>
        <li><strong>Built for reliability.</strong><span>Designed for durability.</span></li>
        <li><strong>Process driven.</strong><span>Performance assured.</span></li>
        <li><strong>Excellence in every step.</strong><span>Assurance in every outcome.</span></li>
      </ul>
    </div>
  </section>
"""

cap += CTA + FOOTER

# --------------------------------------------------------------------------
# projects
# --------------------------------------------------------------------------

proj = head("Projects — NAKJM Infrastructure",
            "Marquee clients and delivered projects: Electriva, VinFast, XPulse "
            "and Tesla charging hubs, industrial factories, educational campuses "
            "and corporate fit-outs.",
            "projects.html")

proj += hero("hub-tesla.jpg", "Tesla Supercharger station delivered by NAKJM in Gurgaon",
             "Projects",
             'Proof of scale, <span class="accent">on the ground.</span>',
             "300+ EV stations, 15+ large charging hubs, ten factory units and a "
             "ground-up school campus &mdash; all executed by the same in-house "
             "teams.",
             short=True)

proj += """
  <!-- mega hubs -->
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Project execution</span>
        <h2>Mega-scale EV hubs &amp; <span class="accent">highway charging.</span></h2>
        <p class="lede">Delivering future-ready charging infrastructure at scale.</p>
      </div>
      <div class="grid grid--2 reveal">
        <a class="tile" href="#economics" style="aspect-ratio:16/10">
          <img src="assets/img/hub-electriva.jpg" alt="Electriva multi-vehicle highway charging hub in Delhi NCR at dusk" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Delhi NCR</span>
            <h3>Electriva &mdash; multi-vehicle highway charging hub</h3>
            <p>Canopied corridor hub built on precision civil pads with underground HT routing.</p>
            <span class="tile__stat">120+ chargers &middot; AC &amp; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="#economics" style="aspect-ratio:16/10">
          <img src="assets/img/hub-vinfast.jpg" alt="VinFast OEM delivery hub and commercial fleet depot" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">OEM delivery hub</span>
            <h3>VinFast &mdash; commercial fleet depot</h3>
            <p>High-density charger array sized for OEM delivery and fleet duty cycles.</p>
            <span class="tile__stat">60+ chargers &middot; AC &amp; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="#economics" style="aspect-ratio:16/10">
          <img src="assets/img/hub-xpulse.jpg" alt="XPulse heavy-duty fleet charging hub at Samalkha, Haryana" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Samalkha, Haryana</span>
            <h3>XPulse &mdash; heavy-duty fleet charging hub</h3>
            <p>Corridor hub for heavy commercial vehicles on continuous duty cycles.</p>
            <span class="tile__stat">70+ chargers &middot; DC fast chargers</span>
          </div>
        </a>
        <a class="tile" href="#economics" style="aspect-ratio:16/10">
          <img src="assets/img/hub-tesla.jpg" alt="Tesla Supercharger station in Gurgaon, Haryana" loading="lazy">
          <div class="tile__body">
            <span class="tile__kicker">Gurgaon, Haryana</span>
            <h3>Tesla &mdash; Supercharger station</h3>
            <p>Full civil, electrical and mounting works to Supercharger specification.</p>
            <span class="tile__stat">16 Superchargers &middot; 250 kW DC</span>
          </div>
        </a>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Large-scale deployment</strong><span>High-capacity hubs enabling multi-vehicle charging.</span></li>
        <li><strong>Fast &amp; reliable charging</strong><span>DC fast chargers ensuring minimal downtime.</span></li>
        <li><strong>Safe &amp; future-ready</strong><span>Built with top safety standards and scalable infrastructure.</span></li>
        <li><strong>Sustainable mobility</strong><span>Powering cleaner roads for a better tomorrow.</span></li>
      </ul>
    </div>
  </section>

  <!-- economics -->
  <section class="section section--paper" id="economics">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Marquee clients</span>
        <h2>Project <span class="accent">economics.</span></h2>
        <p class="lede">A representative view of programme categories, brands and contract values.</p>
      </div>
      <div class="table-scroll reveal">
        <table class="dtable">
          <thead>
            <tr>
              <th scope="col">Project category</th>
              <th scope="col">Notable execution / brand</th>
              <th scope="col">Project value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Multi-station rollout</td><td>Electriva (Delhi NCR) &mdash; 120 stations</td><td class="val">&#8377;1.5 Cr</td></tr>
            <tr><td>EV charging hubs</td><td>Terra Motors (5 hubs), XPulse (6 hubs)</td><td class="val">&#8377;1 Cr+</td></tr>
            <tr><td>Educational infrastructure</td><td>Dynasty International School (ground-up build)</td><td class="val">&#8377;10 Cr <span style="font-weight:500;color:var(--muted)">(ongoing)</span></td></tr>
            <tr><td>Corporate office</td><td>HPCL Staff Office (Lucknow) &mdash; 30,000 sq ft</td><td class="val">&#8377;1 Cr</td></tr>
            <tr><td>Industrial development</td><td>Bawana Factories &mdash; 10 units, 40,000 sq ft each</td><td class="val">&#8377;60 Lakh</td></tr>
            <tr><td>Strategic partners</td><td>DLF, Ansal Group, ERA Group</td><td class="val">Master Vendor Status</td></tr>
          </tbody>
        </table>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Diverse portfolio</strong><span>Across sectors and scales.</span></li>
        <li><strong>Proven execution</strong><span>Trusted by leading brands.</span></li>
        <li><strong>Strong economics</strong><span>Delivering value that lasts.</span></li>
        <li><strong>Long-term partnerships</strong><span>Built on trust and performance.</span></li>
      </ul>
    </div>
  </section>

  <!-- hardware agnosticism -->
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Hardware agnosticism</span>
        <h2>OEM &amp; CPO <span class="accent">deployments.</span></h2>
        <p class="lede">One platform. Any hardware. Limitless possibilities.</p>
      </div>
      <div class="grid grid--3 reveal">
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/tesla-super.jpg" alt="Tesla Supercharger units installed on a landscaped forecourt" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">OEM</span>
            <h3>Tesla Supercharger integration</h3>
            <p>Seamless integration with global DC fast charging standards.</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/cpo-forecourt.jpg" alt="Charging bays integrated into a Jio-bp and Adani fuel retail forecourt" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">CPO</span>
            <h3>Tier-1 CPO network rollout</h3>
            <p>Interoperable with leading CPO hardware across India.</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/dc-multibrand.jpg" alt="DC fast chargers from several manufacturers installed side by side" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Multi-brand</span>
            <h3>Hardware-agnostic DC integration</h3>
            <p>Works with any OEM hardware &mdash; AC or DC.</p>
          </div>
        </article>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Hardware agnostic</strong><span>Compatible with leading OEMs &amp; CPOs.</span></li>
        <li><strong>Future ready</strong><span>Adaptable to evolving technologies.</span></li>
        <li><strong>Reliable &amp; secure</strong><span>Robust integrations with highest uptime.</span></li>
        <li><strong>Scalable nationwide</strong><span>Deploy at any scale across locations.</span></li>
      </ul>
    </div>
  </section>

  <!-- backend -->
  <section class="section section--navy">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">The backend</span>
        <h2>Industrial-grade <span class="accent">infrastructure.</span></h2>
        <p class="lede">Built for reliability. Engineered for performance.</p>
      </div>
      <div class="grid grid--3 reveal">
        <article class="mediacard">
          <div class="mediacard__img" style="aspect-ratio:4/3"><img src="assets/img/trenching.jpg" alt="Heavy cable trenching with ducted HT and LT conduits" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Civil</span>
            <h3>Heavy cable trenching</h3>
            <p>Robust underground cabling for safe and uninterrupted power flow.</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img" style="aspect-ratio:4/3"><img src="assets/img/transformer.jpg" alt="Transformer on a concrete plinth ready for commissioning" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Power</span>
            <h3>Transformer &amp; RMU commissioning</h3>
            <p>High-efficiency systems ensuring stable and reliable power distribution.</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img" style="aspect-ratio:4/3"><img src="assets/img/panel.jpg" alt="Interior of a custom HT/LT panel with busbars and breakers" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Power</span>
            <h3>HT/LT panel engineering</h3>
            <p>Precision-engineered panels for maximum safety and performance.</p>
          </div>
        </article>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Built to last</strong><span>Industrial-grade materials for long-term reliability.</span></li>
        <li><strong>Engineered for excellence</strong><span>Precision execution with stringent quality standards.</span></li>
        <li><strong>Safe &amp; compliant</strong><span>Adhering to highest safety and regulatory norms.</span></li>
        <li><strong>Powering growth</strong><span>Strong infrastructure for scalable operations.</span></li>
      </ul>
    </div>
  </section>

  <!-- beyond EV -->
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Proof of scale</span>
        <h2>Beyond <span class="accent">EV networks.</span></h2>
        <p class="lede">From clean mobility to infrastructure, we build what India needs.</p>
      </div>
      <div class="grid grid--2 reveal">
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/solar-canopy.jpg" alt="Solar-canopied charging forecourt with vehicles charging" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">National EV rollouts</span>
            <h3>120 stations deployed</h3>
            <p>Delivered for Electriva, Terra Motors and XPulse across multi-state programmes.</p>
            <p class="mediacard__meta">Electriva (Delhi NCR) &mdash; &#8377;1.5 Cr</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/factory.jpg" alt="Aerial view of ten factory units under steel-frame construction" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Heavy industrial</span>
            <h3>10 factories, Bawana</h3>
            <p>40,000 sq ft each &mdash; structural steel, floorplates and services in sequence.</p>
            <p class="mediacard__meta">&#8377;60 Lakh</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/school.jpg" alt="Dynasty International School campus with sports fields and residences" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Educational</span>
            <h3>Dynasty School &amp; Motel</h3>
            <p>Complete ground-up build including academic blocks, sports facilities and residences.</p>
            <p class="mediacard__meta">&#8377;10 Cr &mdash; ongoing</p>
          </div>
        </article>
        <article class="mediacard">
          <div class="mediacard__img"><img src="assets/img/office.jpg" alt="Completed corporate office interior with glazed meeting rooms" loading="lazy"></div>
          <div class="mediacard__body">
            <span class="mediacard__kicker">Corporate</span>
            <h3>HPCL Staff Office, Lucknow</h3>
            <p>30,000 sq ft corporate fit-out delivered to programme.</p>
            <p class="mediacard__meta">&#8377;1 Cr</p>
          </div>
        </article>
      </div>
      <ul class="assure reveal" style="margin-top:2.5rem">
        <li><strong>Diverse expertise</strong><span>Across sectors and complexities.</span></li>
        <li><strong>End-to-end delivery</strong><span>Concept to commissioning.</span></li>
        <li><strong>Quality &amp; compliance</strong><span>Built to the highest standards.</span></li>
        <li><strong>Scale that matters</strong><span>Projects that drive real impact.</span></li>
      </ul>
    </div>
  </section>
"""

proj += CTA + FOOTER

# --------------------------------------------------------------------------
# about
# --------------------------------------------------------------------------

about = head("Our Company — NAKJM Infrastructure",
             "NAKJM Infrastructure Pvt Ltd — mission, vision, core values, "
             "workforce structure and the Delhi NCR command centre driving "
             "multi-state infrastructure rollouts.",
             "about.html")

about += hero("tesla-super.jpg", "Tesla Supercharger installation delivered by NAKJM",
              "Our company",
              'The execution engine behind <span class="accent">India\'s build-out.</span>',
              "NAKJM Infrastructure Pvt Ltd is a next-generation infrastructure "
              "company &mdash; fifteen years of EPC discipline applied to the "
              "fastest-moving category in Indian construction.",
              short=True)

about += quicklinks("On this page", [
    ("#mission", "Mission &amp; Vision"), ("#values", "Core Values"),
    ("#impact", "Our Impact"), ("#advantage", "Our Advantage"),
    ("#footprint", "Operating Footprint"), ("#workforce", "Workforce"),
])

about += """
  <!-- mission / vision -->
  <section class="section" id="mission">
    <div class="wrap">
      <div class="grid grid--2 reveal">
        <article class="card">
          <span class="eyebrow">Our mission</span>
          <h3>Engineering India's transition to sustainable mobility</h3>
          <p>
            To engineer and execute India's transition to sustainable mobility
            through uncompromising infrastructure deployment.
          </p>
        </article>
        <article class="card" style="border-top-color:var(--red-600)">
          <span class="eyebrow">Our vision</span>
          <h3>The singular, trusted execution engine</h3>
          <p>
            To be the singular, trusted execution engine for the world's leading
            energy and automotive brands in India.
          </p>
        </article>
      </div>
    </div>
  </section>

  <!-- values -->
  <section class="section section--paper" id="values">
    <div class="wrap">
      <div class="section-head section-head--center">
        <span class="eyebrow">Our core values</span>
        <h2>Three commitments we <span class="accent">do not trade away.</span></h2>
      </div>
      <div class="grid grid--3 reveal">
        <article class="card">
          <div class="card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
            </svg>
          </div>
          <h3>Precision execution</h3>
          <p>Absolute adherence to engineering tolerances &mdash; on the pad, in the panel and at the connection.</p>
        </article>
        <article class="card">
          <div class="card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18M3 12h18"/><path d="M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>
            </svg>
          </div>
          <h3>Unified accountability</h3>
          <p>One central command for the total project lifecycle. No handoffs, no finger-pointing.</p>
        </article>
        <article class="card">
          <div class="card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>
            </svg>
          </div>
          <h3>Hardware agnosticism</h3>
          <p>Flawless integration of any tier-1 OEM equipment. Your hardware choice stays yours.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- impact -->
  <section class="section section--navy" id="impact">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Our impact</span>
        <h2>Track <span class="accent">record.</span></h2>
      </div>
      <ul class="assure reveal">
        <li><strong style="font-size:1.9rem;font-family:var(--font-display)" data-count-to="15" data-suffix="+">15+</strong><span>Years total EPC experience</span></li>
        <li><strong style="font-size:1.9rem;font-family:var(--font-display)" data-count-to="7" data-suffix="+">7+</strong><span>Years EV charging expertise</span></li>
        <li><strong style="font-size:1.9rem;font-family:var(--font-display)" data-count-to="300" data-suffix="+">300+</strong><span>EV stations delivered</span></li>
        <li><strong style="font-size:1.9rem;font-family:var(--font-display)" data-count-to="15" data-suffix="+">15+</strong><span>Large EV charging hubs</span></li>
      </ul>
      <ul class="assure reveal" style="margin-top:1.5rem">
        <li><strong style="font-size:1.5rem;font-family:var(--font-display)">In-house</strong><span>Dedicated civil &amp; electrical teams</span></li>
        <li><strong style="font-size:1.5rem;font-family:var(--font-display)">100%</strong><span>Hardware-agnostic execution</span></li>
      </ul>
    </div>
  </section>

  <!-- advantage -->
  <section class="section" id="advantage">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Our advantage</span>
        <h2>Why unified beats <span class="accent">fragmented.</span></h2>
        <p class="lede">
          The difference is not marginal. It shows up in the schedule, the budget
          and the quality of the connection.
        </p>
      </div>
      <div class="table-scroll reveal">
        <table class="compare">
          <thead>
            <tr>
              <th scope="col"><span class="sr-only">Criterion</span></th>
              <th scope="col">Traditional fragmented contractors</th>
              <th scope="col">The NAKJM next-gen EPC</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Vendor dependency</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Fragmented across 4+ vendors</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>100% unified in-house execution</td>
            </tr>
            <tr>
              <th scope="row">Fabrication speed</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Outsourced with variable delays</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>In-house MS fabrication facility for fast-tracking</td>
            </tr>
            <tr>
              <th scope="row">Technical integration</th>
              <td><span class="mark-no" aria-hidden="true">&#10007;</span>Basic standard wiring</td>
              <td><span class="mark-yes" aria-hidden="true">&#10003;</span>4+ years deep expertise in hardware-agnostic EV integration</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- footprint -->
  <section class="section section--paper" id="footprint">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Nationwide presence. Centralised command.</span>
        <h2>Command centre: <span class="accent">Delhi NCR.</span></h2>
      </div>
      <div class="grid grid--2 reveal" style="align-items:center">
        <div>
          <img src="assets/img/india-map.jpg" width="900" height="845" alt="Map of India showing NAKJM's Delhi NCR headquarters dispatching crews to states nationwide" loading="lazy" style="border:1px solid var(--line);background:#fff;height:auto">
          <p style="margin-top:1.5rem">
            Executing standard 100 km operational radiuses and dedicated
            outstation multi-state rollouts. Our Gurgaon command centre plans,
            dispatches and supervises every site on a hub-and-spoke model that
            keeps supervision close to the work.
          </p>
        </div>
        <div id="workforce">
          <span class="eyebrow">Workforce</span>
          <h3 style="margin-bottom:1.5rem">Three tiers of in-house capability</h3>
          <div class="tier">
            <span class="tier__mark" aria-hidden="true"></span>
            <div><h4>Engineering command</h4><p>Experienced commissioning engineers ensuring quality and safety protocols.</p></div>
          </div>
          <div class="tier">
            <span class="tier__mark" aria-hidden="true"></span>
            <div><h4>Specialised technical units</h4><p>In-house electrical teams, fabrication specialists and fitters.</p></div>
          </div>
          <div class="tier">
            <span class="tier__mark" aria-hidden="true"></span>
            <div><h4>Heavy civil workforce</h4><p>In-house civil teams for rapid turnaround.</p></div>
          </div>
          <p class="callout" style="margin-top:1.5rem">
            <strong>Operational edge:</strong> fully licensed, night-shift
            capable, ready for on-demand crew expansion.
          </p>
        </div>
      </div>
    </div>
  </section>
"""

about += CTA + FOOTER

# --------------------------------------------------------------------------
# contact
# --------------------------------------------------------------------------

contact = head("Contact — NAKJM Infrastructure",
               "Commission the future of your infrastructure. Contact NAKJM "
               "Infrastructure Pvt Ltd in New Delhi for a site survey, "
               "feasibility view and single-contract delivery plan.",
               "contact.html")

contact += hero("hub-vinfast.jpg", "VinFast OEM delivery hub delivered by NAKJM",
                "Contact",
                'Building the <span class="accent">new energy era.</span>',
                "Send us the site, the sanctioned load and the timeline. We come "
                "back with a feasibility view and a single-contract delivery plan.",
                short=True)

contact += f"""
  <section class="section" id="enquiry">
    <div class="wrap">
      <div class="contact-grid">

        <div>
          <span class="eyebrow">Reach us</span>
          <h2>NAKJM Infrastructure <span class="accent">Pvt Ltd</span></h2>
          <p class="lede" style="margin-bottom:2.5rem">Next-generation mega-builders.</p>

          <ul class="contact-list">
            <li>
              <span class="contact-list__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <dl><dt>Address</dt><dd>{ADDR_HTML}</dd></dl>
            </li>
            <li>
              <span class="contact-list__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>
                </svg>
              </span>
              <dl><dt>Phone</dt><dd><a href="tel:{TEL}">{PHONE}</a></dd></dl>
            </li>
            <li>
              <span class="contact-list__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>
                </svg>
              </span>
              <dl><dt>Email</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></dl>
            </li>
            <li>
              <span class="contact-list__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>
                </svg>
              </span>
              <dl><dt>Digital portal</dt><dd><a href="https://{PORTAL}" rel="noopener">{PORTAL}</a></dd></dl>
            </li>
          </ul>

          <div class="callout" style="margin-top:2.5rem">
            <strong>Operating footprint:</strong> command centre in Delhi NCR,
            executing standard 100 km operational radiuses and dedicated
            outstation multi-state rollouts. Fully licensed, night-shift capable
            and ready for on-demand crew expansion.
          </div>
        </div>

        <div>
          <div class="formpanel">
            <span class="eyebrow">Project enquiry</span>
            <h2 style="font-size:clamp(1.5rem,2.6vw,2rem)">Start a conversation</h2>
            <p style="margin-bottom:1.75rem">Fields marked with an asterisk are required.</p>

            <form class="form" id="enquiry-form" novalidate>
              <div class="field--row">
                <div class="field">
                  <label for="name">Full name *</label>
                  <input type="text" id="name" name="name" autocomplete="name" required>
                </div>
                <div class="field">
                  <label for="company">Company *</label>
                  <input type="text" id="company" name="company" autocomplete="organization" required>
                </div>
              </div>
              <div class="field--row">
                <div class="field">
                  <label for="email">Work email *</label>
                  <input type="email" id="email" name="email" autocomplete="email" required>
                </div>
                <div class="field">
                  <label for="phone">Phone</label>
                  <input type="tel" id="phone" name="phone" autocomplete="tel">
                </div>
              </div>
              <div class="field--row">
                <div class="field">
                  <label for="scope">Scope of work *</label>
                  <select id="scope" name="scope" required>
                    <option value="">Select&hellip;</option>
                    <option>EV charging hub / network rollout</option>
                    <option>Residential &amp; distributed AC charging</option>
                    <option>Civil &amp; structural build-out</option>
                    <option>HT/LT electrical &amp; grid integration</option>
                    <option>MS fabrication &amp; canopies</option>
                    <option>O&amp;M / AMC</option>
                    <option>Other</option>
                  </select>
                </div>
                <div class="field">
                  <label for="location">Site location</label>
                  <input type="text" id="location" name="location" placeholder="City / state">
                </div>
              </div>
              <div class="field">
                <label for="message">Project details *</label>
                <textarea id="message" name="message" required
                  placeholder="Number of sites, charger ratings or sanctioned load, target timeline&hellip;"></textarea>
              </div>
              <div class="form__status" id="form-status" role="status" aria-live="polite"></div>
              <button class="btn btn--primary" type="submit">Send enquiry <span class="btn__arrow">&rarr;</span></button>
              <p class="form__note">
                We reply within one working day. Prefer email? Write to
                <a href="mailto:{EMAIL}">{EMAIL}</a> directly.
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  </section>
"""

contact += FOOTER

# --------------------------------------------------------------------------
# 404
# --------------------------------------------------------------------------

notfound = head("Page not found — NAKJM Infrastructure",
                "That page could not be found. Return to NAKJM Infrastructure's "
                "home page or contact us directly.",
                "404.html")

notfound += """
  <section class="hero hero--short">
    <div class="hero__bg">
      <img src="assets/img/hub-xpulse.jpg" alt="" aria-hidden="true" loading="eager">
    </div>
    <div class="wrap">
      <div class="hero__inner">
        <span class="eyebrow">Error 404</span>
        <h1>That page has <span class="accent">moved on.</span></h1>
        <p class="lede">
          The page you were looking for is not here. Everything we build is
          still a click away.
        </p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="index.html">Back to home <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost-light" href="contact.html">Contact us</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Try one of these</span>
        <h2>Where would you <span class="accent">like to go?</span></h2>
      </div>
      <div class="grid grid--4 reveal">
        <article class="card"><h3><a href="capabilities.html">Capabilities</a></h3><p>The three-pillar stack: civil, electrical and EV infrastructure.</p></article>
        <article class="card"><h3><a href="projects.html">Projects</a></h3><p>Mega-scale charging hubs and delivered project economics.</p></article>
        <article class="card"><h3><a href="about.html">Our Company</a></h3><p>Mission, values, operating footprint and workforce.</p></article>
        <article class="card"><h3><a href="contact.html">Contact</a></h3><p>Start a project enquiry or request a site survey.</p></article>
      </div>
    </div>
  </section>
"""

notfound += FOOTER

# --------------------------------------------------------------------------
# write everything
# --------------------------------------------------------------------------

PAGES = [("index.html", index), ("capabilities.html", cap),
         ("projects.html", proj), ("about.html", about),
         ("contact.html", contact), ("404.html", notfound)]

for name, body in PAGES:
    with open(os.path.join(OUT, name), "w") as f:
        f.write(body)
    print("wrote", name, len(body))

# sitemap — 404 is deliberately excluded
today = "2026-08-06"
urls = "\n".join(
    "  <url>\n    <loc>%s/%s</loc>\n    <lastmod>%s</lastmod>\n"
    "    <changefreq>monthly</changefreq>\n    <priority>%s</priority>\n  </url>"
    % (SITE, "" if h == "index.html" else h, today, "1.0" if h == "index.html" else "0.8")
    for h, _ in NAV)

with open(os.path.join(OUT, "sitemap.xml"), "w") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + urls + "\n</urlset>\n")
print("wrote sitemap.xml")

with open(os.path.join(OUT, "robots.txt"), "w") as f:
    f.write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE)
print("wrote robots.txt")
