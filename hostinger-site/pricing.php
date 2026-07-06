<?php
$page_title = 'Pricing — Simple Per-kWh EV Charging Rates | Electriva';
$page_desc  = 'Transparent EV charging prices: AC from ₹15/kWh, DC fast from ₹19/kWh, DC ultra-fast ₹22/kWh. No hidden fees. Electriva Prime members save 10% on every session.';
require __DIR__ . '/includes/header.php';

/* Edit tariffs here — the page renders from this array. */
$tariffs = [
    [
        'name'  => 'AC Charging',
        'power' => '3.3 – 22 kW',
        'price' => '15',
        'unit'  => '/kWh',
        'best'  => 'Overnight & workplace parking',
        'perks' => ['Type 2 & 3-pin sockets', 'Ideal for 2W, 3W & cars', 'Schedule via app', 'Pay per kWh consumed'],
        'featured' => false,
    ],
    [
        'name'  => 'DC Fast',
        'power' => '30 – 60 kW',
        'price' => '19',
        'unit'  => '/kWh',
        'best'  => 'City top-ups while you shop',
        'perks' => ['CCS2 & CHAdeMO', '80% in 45–60 min', 'Live availability in app', 'GST invoice every session'],
        'featured' => true,
    ],
    [
        'name'  => 'DC Ultra',
        'power' => '120 – 240 kW',
        'price' => '22',
        'unit'  => '/kWh',
        'best'  => 'Highways & road trips',
        'perks' => ['Up to 240 kW CCS2', '~250 km in 20 min', 'Reserved bays for members', 'Highway plazas with food courts'],
        'featured' => false,
    ],
    [
        'name'  => 'Battery Swap',
        'power' => '2W & 3W',
        'price' => '99',
        'unit'  => '/swap',
        'best'  => 'Riders & delivery fleets',
        'perks' => ['Swap in ~60 seconds', 'Unlimited plans from ₹1,999/mo', '1000+ swap stations', 'Fleet billing available'],
        'featured' => false,
    ],
];
?>

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Pricing</span>
    <h1>Simple rates. <span class="grad">Zero surprises.</span></h1>
    <p class="lede">Pay only for the energy you use. Every session ends with a GST invoice on WhatsApp &amp; email.</p>
  </div>
</section>

<!-- ═══════════════ Tariff cards ═══════════════ -->
<section class="section section--tight">
  <div class="container">
    <div class="price-grid">
      <?php foreach ($tariffs as $t): ?>
      <article class="price-card<?= $t['featured'] ? ' price-card--featured' : '' ?> reveal">
        <?php if ($t['featured']): ?><span class="price-card__flag">Most popular</span><?php endif; ?>
        <h3><?= e($t['name']) ?></h3>
        <p class="price-card__power"><?= e($t['power']) ?></p>
        <p class="price-card__price"><sup>₹</sup><?= e($t['price']) ?><span><?= e($t['unit']) ?></span></p>
        <p class="price-card__best"><?= e($t['best']) ?></p>
        <ul>
          <?php foreach ($t['perks'] as $perk): ?>
          <li><?= e($perk) ?></li>
          <?php endforeach; ?>
        </ul>
        <a class="btn <?= $t['featured'] ? 'btn--primary' : 'btn--ghost' ?>" href="network.php">Find a Charger</a>
      </article>
      <?php endforeach; ?>
    </div>
    <p class="price-note">Rates include energy charges; taxes as applicable. Rates can vary slightly by site and are always shown in the app before you start.</p>
  </div>
</section>

<!-- ═══════════════ Prime membership ═══════════════ -->
<section class="section section--dark">
  <div class="container prime">
    <div class="prime__copy reveal">
      <span class="eyebrow">Electriva Prime</span>
      <h2>Charge more. <span class="grad">Pay less.</span></h2>
      <p class="lede-sm">One membership across the entire network — chargers and swap stations included.</p>
      <ul class="ticks">
        <li><strong>10% off</strong> every charging session</li>
        <li><strong>Free reservations</strong> on DC Ultra bays</li>
        <li><strong>Priority support</strong> line — skip the queue</li>
        <li><strong>Partner offers</strong> at station cafés &amp; stores</li>
      </ul>
    </div>
    <div class="prime__card reveal">
      <h3>Prime</h3>
      <p class="prime__price"><sup>₹</sup>199<span>/month</span></p>
      <p>or ₹1,999/year — 2 months free</p>
      <a class="btn btn--primary btn--lg" href="contact.php">Join the Waitlist</a>
      <small>Cancel anytime. Savings shown in every invoice.</small>
    </div>
  </div>
</section>

<!-- ═══════════════ Cost example ═══════════════ -->
<section class="section">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">What a charge really costs</span>
      <h2>Cheaper than petrol. Every time.</h2>
    </div>

    <div class="table-scroll reveal">
      <table class="cost-table">
        <thead>
          <tr><th>Vehicle</th><th>Battery</th><th>Typical session</th><th>Approx. cost</th><th>Range added</th></tr>
        </thead>
        <tbody>
          <tr><td>Electric scooter</td><td>3 kWh</td><td>0 → 100% on AC</td><td>₹45</td><td>~100 km</td></tr>
          <tr><td>Compact EV (Tiago/Comet)</td><td>24 kWh</td><td>20 → 80% on DC Fast</td><td>₹274</td><td>~150 km</td></tr>
          <tr><td>Mid-size EV (Nexon/ZS)</td><td>40 kWh</td><td>20 → 80% on DC Fast</td><td>₹456</td><td>~200 km</td></tr>
          <tr><td>Premium EV (BE 6/XEV 9e)</td><td>79 kWh</td><td>10 → 80% on DC Ultra</td><td>₹1,217</td><td>~380 km</td></tr>
        </tbody>
      </table>
    </div>
    <p class="price-note">Illustrative examples at standard rates. Real-world range varies with vehicle, weather and driving style.</p>
  </div>
</section>

<!-- ═══════════════ Payments ═══════════════ -->
<section class="section section--alt">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow eyebrow--dark">Payments</span>
      <h2>Pay your way</h2>
    </div>
    <div class="cards-3 cards-3--slim">
      <article class="card reveal"><h3>UPI</h3><p>Scan the QR on the charger or pay in-app. Works with every UPI app.</p></article>
      <article class="card reveal"><h3>Cards &amp; Netbanking</h3><p>Credit, debit and netbanking via secure payment gateway.</p></article>
      <article class="card reveal"><h3>Electriva Wallet</h3><p>Preload once, auto-pay every session. Fleet wallets with monthly statements.</p></article>
    </div>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
