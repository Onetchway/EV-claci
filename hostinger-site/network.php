<?php
$page_title = 'Our Network — Find an EV Charging Station | Electriva';
$page_desc  = 'Explore Electriva\'s EV charging network across 35+ Indian cities. Search stations by city or charger type — DC ultra-fast, DC fast, AC and battery swapping.';
$use_map    = true;                    // loads Leaflet only on this page

$stations = require __DIR__ . '/data/stations.php';

/* Data for the map / JS filters (footer prints it as window.ELECTRIVA) */
$stations_json = $stations;

/* Distinct city + type lists for the filter controls */
$cities = array_values(array_unique(array_map(fn($s) => $s['city'], $stations)));
sort($cities);
$types  = array_values(array_unique(array_map(fn($s) => $s['type'], $stations)));
sort($types);

require __DIR__ . '/includes/header.php';
?>

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Our network</span>
    <h1>Find your next <span class="grad">charge</span></h1>
    <p class="lede"><?= count($stations) ?> stations and growing — across metros, tech parks, malls and highways.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container">

    <!-- Filters -->
    <div class="filters" id="filters">
      <div class="filters__search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <label class="sr-only" for="stationSearch">Search stations</label>
        <input type="search" id="stationSearch" placeholder="Search by city, station or address…" autocomplete="off">
      </div>

      <div class="filters__group">
        <label class="sr-only" for="cityFilter">Filter by city</label>
        <select id="cityFilter">
          <option value="">All cities</option>
          <?php foreach ($cities as $c): ?>
          <option value="<?= e($c) ?>"><?= e($c) ?></option>
          <?php endforeach; ?>
        </select>
      </div>

      <div class="filters__chips" role="group" aria-label="Filter by charger type">
        <button class="chip active" data-type="">All types</button>
        <?php foreach ($types as $t): ?>
        <button class="chip" data-type="<?= e($t) ?>"><?= e($t) ?></button>
        <?php endforeach; ?>
      </div>
    </div>

    <p class="filters__count" id="stationCount"><?= count($stations) ?> stations</p>

    <!-- Map + list -->
    <div class="network-layout">
      <div class="network-map-wrap">
        <div id="stationMap" class="network-map" aria-label="Map of Electriva charging stations">
          <noscript><p class="map-fallback">Enable JavaScript to view the interactive map. All stations are listed below.</p></noscript>
        </div>
      </div>

      <div class="station-list" id="stationList">
        <?php foreach ($stations as $st): ?>
        <article class="station"
                 data-id="<?= e($st['id']) ?>"
                 data-city="<?= e($st['city']) ?>"
                 data-type="<?= e($st['type']) ?>"
                 data-search="<?= e(strtolower($st['name'] . ' ' . $st['city'] . ' ' . $st['state'] . ' ' . $st['address'])) ?>">
          <div class="station__top">
            <span class="badge badge--type"><?= e($st['type']) ?></span>
            <span class="badge <?= $st['status'] === 'Live' ? 'badge--live' : 'badge--soon' ?>">● <?= e($st['status']) ?></span>
          </div>
          <h3><?= e($st['name']) ?></h3>
          <p class="station__addr"><?= e($st['address']) ?></p>
          <div class="station__meta">
            <span title="Max power">⚡ <?= e($st['power']) ?></span>
            <span title="Charging guns">🔌 <?= (int) $st['guns'] ?> guns</span>
            <span title="Hours">🕐 <?= e($st['hours']) ?></span>
          </div>
          <div class="station__tags">
            <?php foreach ($st['connectors'] as $con): ?>
            <span class="tag"><?= e($con) ?></span>
            <?php endforeach; ?>
          </div>
          <div class="station__actions">
            <a class="btn btn--sm btn--primary" target="_blank" rel="noopener"
               href="https://www.google.com/maps/dir/?api=1&destination=<?= e($st['lat']) ?>,<?= e($st['lng']) ?>">
              Get Directions
            </a>
            <button class="btn btn--sm btn--ghost js-map-focus" data-id="<?= e($st['id']) ?>" type="button">View on Map</button>
          </div>
        </article>
        <?php endforeach; ?>

        <p class="station-empty" id="stationEmpty" hidden>
          No stations match your filters — try clearing the search.
          Can't find one near you? <a href="contact.php">Request a station</a>.
        </p>
      </div>
    </div>

    <!-- Legend / help -->
    <div class="net-help reveal">
      <div>
        <h3>Charger types explained</h3>
        <ul class="ticks ticks--2col">
          <li><strong>DC Ultra (120–240 kW)</strong> — road-trip fast: ~250 km in 20 min</li>
          <li><strong>DC Fast (30–60 kW)</strong> — city fast: top up while you shop</li>
          <li><strong>AC (3.3–22 kW)</strong> — park &amp; charge: offices, malls, homes</li>
          <li><strong>Battery Swap</strong> — 60-second swaps for 2W &amp; 3W</li>
        </ul>
      </div>
      <div class="net-help__cta">
        <h3>Don't see your city?</h3>
        <p>We're adding new stations every month. Tell us where you need one.</p>
        <a class="btn btn--primary" href="contact.php">Request a Station</a>
      </div>
    </div>

  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
