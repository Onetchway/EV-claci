<?php
/**
 * ============================================================
 *  ELECTRIVA — Site configuration
 *  ------------------------------------------------------------
 *  This is the ONLY file you need to edit to customise the site:
 *  brand name, contact details, social links and headline stats.
 *  No database is used anywhere on this website.
 * ============================================================
 */

session_start();

/* ---------- Brand ---------- */
define('SITE_NAME',    'Electriva');
define('SITE_TAGLINE', 'Powering the future of electric mobility');
define('SITE_COMPANY', 'Zivah International Private Limited');

/* ---------- Contact (EDIT THESE) ---------- */
define('CONTACT_EMAIL', 'hello@electriva.in');   // where form submissions are sent
define('CONTACT_PHONE', '+91 98765 43210');
define('CONTACT_WHATSAPP', '919876543210');       // digits only, with country code
define('CONTACT_ADDRESS', 'Plot 42, Udyog Vihar Phase IV, Gurugram, Haryana 122015, India');
define('SUPPORT_HOURS', '24×7 charging support');

/* ---------- Social links (leave '' to hide) ---------- */
$SOCIALS = [
    'LinkedIn'  => 'https://www.linkedin.com/',
    'Instagram' => 'https://www.instagram.com/',
    'X'         => 'https://x.com/',
    'YouTube'   => 'https://www.youtube.com/',
];

/* ---------- Headline stats (shown on home & about) ---------- */
$STATS = [
    ['num' => 1350, 'suffix' => '+',    'label' => 'Charging points'],
    ['num' => 375,  'suffix' => '+',    'label' => 'Charging stations'],
    ['num' => 35,   'suffix' => '+',    'label' => 'Cities covered'],
    ['num' => 17,   'suffix' => '+',    'label' => 'States & Nepal'],
    ['num' => 1000, 'suffix' => '+',    'label' => 'Battery swap stations'],
    ['num' => 10,   'suffix' => ' MW+', 'label' => 'Solar installed'],
];

/* ---------- Primary navigation ---------- */
$NAV = [
    'index.php'    => 'Home',
    'network.php'  => 'Our Network',
    'pricing.php'  => 'Pricing',
    'business.php' => 'For Business',
    'about.php'    => 'About',
    'faq.php'      => 'FAQ',
];

/* ============================================================
 *  Helpers — nothing below normally needs editing
 * ============================================================ */

/** Escape a string for safe HTML output. */
function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

/** Current page filename, e.g. "pricing.php". */
function current_page(): string
{
    return basename($_SERVER['SCRIPT_NAME'] ?? 'index.php');
}

/** "class=active" helper for nav links. */
function nav_active(string $file): string
{
    return current_page() === $file ? ' class="active"' : '';
}

/** Set a one-time flash message (survives one redirect). */
function flash_set(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

/** Read & clear the flash message. */
function flash_get(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

/** Sticky form value after a validation error. */
function old(string $key): string
{
    return e($_SESSION['old'][$key] ?? '');
}
