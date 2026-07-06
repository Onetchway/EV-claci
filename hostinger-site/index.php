<?php
$page_title = 'Electriva — EV Charging Network in India | Fast, Reliable, Green';
$page_desc  = 'Charge your EV on India\'s greenest network. 1350+ charging points, DC ultra-fast charging up to 240 kW, battery swapping and 24×7 support across 35+ cities.';
require __DIR__ . '/includes/header.php';

$stations       = require __DIR__ . '/data/stations.php';
$live_stations  = array_values(array_filter($stations, fn($s) => $s['status'] === 'Live'));
$preview        = array_slice($live_stations, 0, 3);
?>

<!-- ═══════════════ Hero ═══════════════ -->
<section class="hero">
  <div class="hero__bg" aria-hidden="true"></div>
  <div class="container hero__inner">
    <div class="hero__copy">
      <span class="eyebrow">⚡ Keeping India Charged</span>
      <h1>Charge fast.<br>Drive far.<br><span class="grad">Stay green.</span></h1>
      <p class="lede">
        India's most reliable EV charging network — ultra-fast DC charging up to
        <strong>240&nbsp;kW</strong>, smart AC points and battery swapping, powered by the sun.
      </p>
      <div class="hero__actions">
        <a class="btn btn--primary btn--lg" href="network.php">Find a Charger Near You</a>
        <a class="btn btn--ghost-light btn--lg" href="pricing.php">View Pricing</a>
      </div>
      <ul class="hero__ticks">
        <li>No waiting — live availability</li>
        <li>UPI, cards &amp; wallet payments</li>
        <li>24×7 human support</li>
      </ul>
    </div>

    <div class="hero__visual" aria-hidden="true">
      <div class="charge-card">
        <div class="charge-card__head">
          <span class="pulse-dot"></span> Charging session
        </div>
        <div class="charge-card__ring">
          <svg viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-val" cx="60" cy="60" r="52"/>
          </svg>
          <div class="charge-card__pct"><strong data-count="80" data-suffix="%">0%</strong><span>battery</span></div>
        </div>
        <div class="charge-card__rows">
          <div><span>Power</span><strong>238 kW</strong></div>
          <div><span>Energy</span><strong>42.6 kWh</strong></div>
          <div><span>Time left</span><strong>07 min</strong></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════ Stats ═══════════════ -->
<section class="stats">
  <div class="container">
    <div class="stats__grid">
      <?php foreach ($GLOBALS['STATS'] as $s): ?>
      <div class="stat reveal" data-count="<?= (int) $s['num'] ?>" data-suffix="<?= e($s['suffix']) ?>">
        <strong class="stat__num">0</strong>
        <span><?= e($s['label']) ?></span>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ═══════════════ How it works ═══════════════ -->
<section class="section">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">How it works</span>
      <h2>Charging in three easy steps</h2>
      <p>From plugging in to driving off — designed to be simpler than a fuel stop.</p>
    </div>

    <div class="steps">
      <article class="step reveal">
        <span class="step__num">01</span>
        <div class="step__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
        </div>
        <h3>Locate</h3>
        <p>Find the nearest Electriva station on our network map with live gun availability and directions.</p>
      </article>
      <article class="step reveal">
        <span class="step__num">02</span>
        <div class="step__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
        </div>
        <h3>Plug &amp; charge</h3>
        <p>Tap your RFID card or scan the QR at the charger. CCS2, CHAdeMO and Type&nbsp;2 supported.</p>
      </article>
      <article class="step reveal">
        <span class="step__num">03</span>
        <div class="step__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
        </div>
        <h3>Pay &amp; go</h3>
        <p>Pay per kWh with UPI, card or wallet. Instant invoice on WhatsApp and email — no surprises.</p>
      </article>
    </div>
  </div>
</section>

<!-- ═══════════════ Why Electriva ═══════════════ -->
<section class="section section--alt">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">Why Electriva</span>
      <h2>Built for every EV, every journey</h2>
      <p>From a 2-wheeler top-up in the city to an e-bus depot on the highway — one network does it all.</p>
    </div>

    <div class="cards-3">
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
        </div>
        <h3>Ultra-fast DC</h3>
        <p>Infinity DC Series chargers from 30 to 240 kW. Add up to 250 km of range in about 20 minutes.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>
        </div>
        <h3>Truly green energy</h3>
        <p>10 MW+ of solar behind the network. Every kWh you charge is matched with renewable power.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <h3>99% uptime promise</h3>
        <p>Remotely monitored 24×7 with on-ground service teams. If a charger is on the map, it works.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="14" height="10" rx="2"/><path d="M16 10h3l3 3v4h-6zM7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
        </div>
        <h3>Every vehicle type</h3>
        <p>Cars, 2-wheelers, 3-wheelers, fleets and e-buses — AC, DC and 1000+ battery-swap stations.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
        </div>
        <h3>Transparent pricing</h3>
        <p>Simple per-kWh rates from ₹15. No hidden fees, no parking traps. GST invoice for every session.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.5-.7L3 21l1.8-5.5a8.4 8.4 0 1 1 16.2-4z"/></svg>
        </div>
        <h3>Support that answers</h3>
        <p>Real humans on call and WhatsApp, round the clock, in English and Hindi. Average pickup: 12 seconds.</p>
      </article>
    </div>
  </div>
</section>

<!-- ═══════════════ Chargers / Products ═══════════════ -->
<section class="section">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">Our chargers</span>
      <h2>Hardware for every location</h2>
      <p>Designed, engineered and manufactured in India by Electriva.</p>
    </div>

    <div class="chargers">
      <article class="charger reveal">
        <div class="charger__badge">AC · Homes &amp; Offices</div>
        <h3>Trio &amp; Nimbus</h3>
        <p class="charger__power">3.3 – 22 kW</p>
        <ul>
          <li>Type 2 &amp; 3-pin sockets</li>
          <li>App control &amp; scheduling</li>
          <li>Ideal for overnight &amp; workplace charging</li>
        </ul>
        <a class="btn btn--ghost" href="business.php">Get one installed</a>
      </article>

      <article class="charger charger--featured reveal">
        <div class="charger__badge">DC · Highways &amp; Hubs</div>
        <h3>Infinity DC Series</h3>
        <p class="charger__power">30 – 240 kW</p>
        <ul>
          <li>CCS2 + CHAdeMO, dual-gun</li>
          <li>Dynamic power sharing</li>
          <li>250 km range in ~20 minutes</li>
        </ul>
        <a class="btn btn--primary" href="network.php">Charge on the network</a>
      </article>

      <article class="charger reveal">
        <div class="charger__badge">Swap · 2W &amp; 3W</div>
        <h3>BSS Infrastructure</h3>
        <p class="charger__power">60-second swap</p>
        <ul>
          <li>1000+ swap stations</li>
          <li>Subscription plans for riders</li>
          <li>Perfect for delivery fleets</li>
        </ul>
        <a class="btn btn--ghost" href="business.php">Fleet solutions</a>
      </article>
    </div>
  </div>
</section>

<!-- ═══════════════ Network preview ═══════════════ -->
<section class="section section--dark">
  <div class="container">
    <div class="section__head section__head--light reveal">
      <span class="eyebrow">The network</span>
      <h2>35+ cities. 17+ states. And Nepal.</h2>
      <p>Metro hubs, tech parks, malls and highway plazas — always a charger on your route.</p>
    </div>

    <div class="net-preview">
      <?php foreach ($preview as $st): ?>
      <article class="net-card reveal">
        <div class="net-card__top">
          <span class="badge badge--type"><?= e($st['type']) ?></span>
          <span class="badge badge--live">● <?= e($st['status']) ?></span>
        </div>
        <h3><?= e($st['name']) ?></h3>
        <p class="net-card__addr"><?= e($st['address']) ?></p>
        <div class="net-card__meta">
          <span>⚡ <?= e($st['power']) ?></span>
          <span>🔌 <?= (int) $st['guns'] ?> guns</span>
          <span>🕐 <?= e($st['hours']) ?></span>
        </div>
      </article>
      <?php endforeach; ?>
    </div>

    <div class="section__cta reveal">
      <a class="btn btn--primary btn--lg" href="network.php">Explore the Full Network Map</a>
    </div>
  </div>
</section>

<!-- ═══════════════ App ═══════════════ -->
<section class="section">
  <div class="container app">
    <div class="app__copy reveal">
      <span class="eyebrow eyebrow--dark">Electriva App</span>
      <h2>Your charging co-pilot</h2>
      <p class="lede-sm">Find, navigate, charge and pay — all from one app. Track every rupee and every green kilometre.</p>
      <ul class="ticks">
        <li>Live charger availability &amp; reservations</li>
        <li>Start / stop charging remotely</li>
        <li>UPI, cards, wallet &amp; auto-pay</li>
        <li>Charging history &amp; GST invoices</li>
      </ul>
      <div class="app__stores">
        <a class="store-btn" href="#" aria-label="Get it on Google Play">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3.5v17c0 .4.5.7.8.4l9.6-8.1c.3-.2.3-.6 0-.8L4.8 3.1c-.3-.3-.8 0-.8.4zM15.9 10l2.8-2.3c.5-.4 1.3-.1 1.3.6v7.4c0 .7-.8 1-1.3.6L15.9 14"/></svg>
          <span><small>GET IT ON</small>Google Play</span>
        </a>
        <a class="store-btn" href="#" aria-label="Download on the App Store">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.9zM14 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.8-1.4z"/></svg>
          <span><small>DOWNLOAD ON THE</small>App Store</span>
        </a>
      </div>
    </div>

    <div class="app__visual reveal" aria-hidden="true">
      <div class="phone">
        <div class="phone__notch"></div>
        <div class="phone__screen">
          <div class="phone__row phone__row--head">
            <strong>Nearby chargers</strong><span>Map ▸</span>
          </div>
          <?php foreach ($preview as $st): ?>
          <div class="phone__row">
            <div>
              <strong><?= e($st['city']) ?></strong>
              <span><?= e($st['type']) ?> · <?= e($st['power']) ?></span>
            </div>
            <span class="phone__pill">● Available</span>
          </div>
          <?php endforeach; ?>
          <div class="phone__charge">
            <span>⚡ Charging — 80%</span>
            <div class="phone__bar"><i></i></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════ Testimonials ═══════════════ -->
<section class="section section--alt">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">Loved by drivers</span>
      <h2>Charging stories from the road</h2>
    </div>
    <div class="quotes">
      <blockquote class="quote reveal">
        <p>“Drove Delhi to Jaipur with one 25-minute stop at the Electriva highway hub. Coffee finished after the car did.”</p>
        <footer><strong>Rohit S.</strong><span>Nexon EV · Delhi</span></footer>
      </blockquote>
      <blockquote class="quote reveal">
        <p>“Our delivery fleet swaps batteries in under a minute. Riders don't wait, orders don't wait.”</p>
        <footer><strong>Priya M.</strong><span>Fleet Manager · Lucknow</span></footer>
      </blockquote>
      <blockquote class="quote reveal">
        <p>“The app shows live availability, so I never reach a busy charger. Payments are UPI — done in seconds.”</p>
        <footer><strong>Arjun K.</strong><span>MG ZS EV · Bengaluru</span></footer>
      </blockquote>
    </div>
  </div>
</section>

<!-- ═══════════════ Business teaser ═══════════════ -->
<section class="section">
  <div class="container biz-teaser reveal">
    <div>
      <span class="eyebrow eyebrow--dark">For business &amp; land partners</span>
      <h2>Own the charging revolution</h2>
      <p class="lede-sm">
        Have land, parking or a fuel station? Host an Electriva hub through our CoCo, PoCo or
        Franchise models and earn from every kWh.
      </p>
      <a class="btn btn--primary btn--lg" href="business.php">Become a Partner</a>
    </div>
    <ul class="biz-teaser__points">
      <li><strong>Zero to low capex</strong><span>flexible investment models</span></li>
      <li><strong>Revenue share</strong><span>monthly payouts, full dashboard</span></li>
      <li><strong>We handle it all</strong><span>EPC, operations &amp; maintenance</span></li>
    </ul>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
