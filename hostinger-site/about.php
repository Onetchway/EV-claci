<?php
$page_title = 'About Us — The Team Powering India\'s EV Movement | Electriva';
$page_desc  = 'Electriva, a brand of Zivah International, builds India\'s greenest EV charging network: 1350+ charging points, 1000+ swap stations, 10 MW+ of solar across 17+ states and Nepal.';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">About us</span>
    <h1>We exist so India can <span class="grad">drive electric</span></h1>
    <p class="lede">
      Electriva is a leading Charge Point Operator building the sustainable, high-speed
      backbone of tomorrow's transportation — from 2-wheelers to e-buses.
    </p>
  </div>
</section>

<!-- ═══════════════ Mission ═══════════════ -->
<section class="section">
  <div class="container about-split">
    <div class="reveal">
      <span class="eyebrow eyebrow--dark">Our mission</span>
      <h2>Charging that never holds you back</h2>
      <p class="lede-sm">
        Range anxiety kills EV adoption. We kill range anxiety — with a dense, reliable,
        renewably-powered network where every charger on the map simply works.
      </p>
      <p>
        Born from <?= e(SITE_COMPANY) ?>'s solar EPC roots — 10&nbsp;MW+ installed across four
        states — we pivoted our energy expertise into EV infrastructure: designing and
        manufacturing our own chargers, building stations, and operating them 24×7.
      </p>
    </div>
    <div class="stats-mini reveal">
      <?php foreach ($GLOBALS['STATS'] as $s): ?>
      <div class="stat" data-count="<?= (int) $s['num'] ?>" data-suffix="<?= e($s['suffix']) ?>">
        <strong class="stat__num">0</strong>
        <span><?= e($s['label']) ?></span>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ═══════════════ Journey ═══════════════ -->
<section class="section section--alt">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">Our journey</span>
      <h2>From solar rooftops to a national network</h2>
    </div>

    <ol class="timeline">
      <li class="reveal">
        <h3>Foundation</h3>
        <p>Zivah International builds a solar EPC business — 10 MW+ across 4 states — mastering the energy side of the equation.</p>
      </li>
      <li class="reveal">
        <h3>The pivot</h3>
        <p>We strategically move into EV charger development: the Trio &amp; Nimbus AC line and the Infinity DC series are born.</p>
      </li>
      <li class="reveal">
        <h3>Launch &amp; manufacturing</h3>
        <p>Electriva launches as a CPO with in-house manufacturing — deploying chargers and battery-swap stations at scale.</p>
      </li>
      <li class="reveal">
        <h3>Scale &amp; international</h3>
        <p>1350+ charging points across 17+ states, 1000+ swap stations, and our first international network in Nepal.</p>
      </li>
    </ol>
  </div>
</section>

<!-- ═══════════════ Values ═══════════════ -->
<section class="section">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">What we stand for</span>
      <h2>Values that keep us charged</h2>
    </div>
    <div class="cards-3">
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg></div>
        <h3>Green first</h3>
        <p>Charging an EV with coal power misses the point. We build solar into our network from day one.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h3>Reliability is respect</h3>
        <p>A broken charger strands a driver. Uptime isn't a metric for us — it's a promise we engineer for.</p>
      </article>
      <article class="card reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <h3>Every vehicle matters</h3>
        <p>India runs on 2-wheelers and 3-wheelers as much as cars. Our network is built for all of them.</p>
      </article>
    </div>
  </div>
</section>

<!-- ═══════════════ Impact ═══════════════ -->
<section class="section section--dark">
  <div class="container impact reveal">
    <div>
      <span class="eyebrow">Impact</span>
      <h2><span class="stat__num" data-count="1350000" data-suffix="+">0</span><br>green kilometres powered</h2>
      <p class="lede-sm">Every session on our network displaces petrol and diesel — and it adds up fast.</p>
    </div>
    <div class="impact__points">
      <div><strong>Solar-matched</strong><span>10 MW+ renewable capacity behind the network</span></div>
      <div><strong>Make in India</strong><span>Chargers designed &amp; manufactured domestically</span></div>
      <div><strong>Jobs on the ground</strong><span>Local service &amp; station teams in every region</span></div>
    </div>
  </div>
</section>

<!-- ═══════════════ CTA ═══════════════ -->
<section class="section">
  <div class="container biz-teaser reveal">
    <div>
      <span class="eyebrow eyebrow--dark">Join the mission</span>
      <h2>Build the network with us</h2>
      <p class="lede-sm">Drivers, land partners, fleets, cities — the electric future needs all of us.</p>
      <div class="hero__actions">
        <a class="btn btn--primary btn--lg" href="business.php">Partner With Us</a>
        <a class="btn btn--ghost btn--lg" href="contact.php">Talk to the Team</a>
      </div>
    </div>
    <ul class="biz-teaser__points">
      <li><strong>17+ states</strong><span>and growing every quarter</span></li>
      <li><strong>Nepal live</strong><span>our first international market</span></li>
      <li><strong>One team</strong><span>hardware, software &amp; operations in-house</span></li>
    </ul>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
