<?php
http_response_code(404);
$page_title = 'Page Not Found — Electriva';
$page_desc  = 'The page you were looking for has moved or never existed.';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero page-hero--tall">
  <div class="container">
    <span class="eyebrow">Error 404</span>
    <h1>Out of <span class="grad">charge</span></h1>
    <p class="lede">This page doesn't exist — but a charger near you definitely does.</p>
    <div class="hero__actions">
      <a class="btn btn--primary btn--lg" href="index.php">Back to Home</a>
      <a class="btn btn--ghost-light btn--lg" href="network.php">Find a Charger</a>
    </div>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
