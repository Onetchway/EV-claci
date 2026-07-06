<?php
/**
 * Shared <head> + navigation.
 * Each page sets $page_title / $page_desc before including this file.
 */
require_once __DIR__ . '/config.php';

$page_title = $page_title ?? SITE_NAME . ' — ' . SITE_TAGLINE;
$page_desc  = $page_desc  ?? 'Electriva is a leading EV Charging Point Operator in India building an extensive, high-speed and truly green charging network — AC, DC fast charging and battery swapping.';
$flash      = flash_get();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($page_title) ?></title>
  <meta name="description" content="<?= e($page_desc) ?>">
  <meta name="theme-color" content="#07150f">
  <meta property="og:title" content="<?= e($page_title) ?>">
  <meta property="og:description" content="<?= e($page_desc) ?>">
  <meta property="og:type" content="website">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
<?php if (!empty($use_map)): ?>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<?php endif; ?>
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

<header class="nav" id="nav">
  <div class="container nav__inner">
    <a class="brand" href="index.php" aria-label="<?= e(SITE_NAME) ?> home">
      <span class="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
          <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" fill="currentColor"/>
        </svg>
      </span>
      <span class="brand__text">Electri<span>va</span></span>
    </a>

    <nav class="nav__links" id="navLinks" aria-label="Primary">
      <?php foreach ($GLOBALS['NAV'] as $file => $label): ?>
      <a href="<?= e($file) ?>"<?= nav_active($file) ?>><?= e($label) ?></a>
      <?php endforeach; ?>
      <a class="btn btn--primary nav__cta" href="contact.php">Contact Us</a>
    </nav>

    <button class="nav__toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navLinks">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<?php if ($flash): ?>
<div class="toast toast--<?= e($flash['type']) ?>" id="toast" role="status">
  <span><?= e($flash['message']) ?></span>
  <button type="button" aria-label="Dismiss" onclick="this.parentElement.remove()">&times;</button>
</div>
<?php endif; ?>

<main id="main">
