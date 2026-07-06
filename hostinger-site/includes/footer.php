</main>

<footer class="footer">
  <div class="container">

    <div class="footer__cta reveal">
      <div>
        <h2>Never worry about your next charge.</h2>
        <p>Join thousands of EV drivers charging on India's greenest network.</p>
      </div>
      <div class="footer__cta-actions">
        <a class="btn btn--primary btn--lg" href="network.php">Find a Charger</a>
        <a class="btn btn--ghost-light btn--lg" href="business.php">Partner With Us</a>
      </div>
    </div>

    <div class="footer__grid">
      <div class="footer__brand">
        <a class="brand brand--light" href="index.php">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" fill="currentColor"/>
            </svg>
          </span>
          <span class="brand__text">Electri<span>va</span></span>
        </a>
        <p><?= e(SITE_TAGLINE) ?>. A brand of <?= e(SITE_COMPANY) ?>.</p>
        <div class="footer__social">
          <?php foreach ($GLOBALS['SOCIALS'] as $name => $url): if ($url === '') continue; ?>
          <a href="<?= e($url) ?>" target="_blank" rel="noopener"><?= e($name) ?></a>
          <?php endforeach; ?>
        </div>
      </div>

      <nav class="footer__col" aria-label="Company">
        <h4>Company</h4>
        <a href="about.php">About Us</a>
        <a href="network.php">Our Network</a>
        <a href="business.php">For Business</a>
        <a href="contact.php">Contact</a>
      </nav>

      <nav class="footer__col" aria-label="Drivers">
        <h4>Drivers</h4>
        <a href="network.php">Find a Charger</a>
        <a href="pricing.php">Pricing</a>
        <a href="faq.php">Help &amp; FAQ</a>
        <a href="contact.php">24×7 Support</a>
      </nav>

      <div class="footer__col">
        <h4>Get in Touch</h4>
        <a href="mailto:<?= e(CONTACT_EMAIL) ?>"><?= e(CONTACT_EMAIL) ?></a>
        <a href="tel:<?= e(preg_replace('/\s+/', '', CONTACT_PHONE)) ?>"><?= e(CONTACT_PHONE) ?></a>
        <a href="https://wa.me/<?= e(CONTACT_WHATSAPP) ?>" target="_blank" rel="noopener">WhatsApp Support</a>
        <p class="footer__addr"><?= e(CONTACT_ADDRESS) ?></p>
      </div>

      <div class="footer__col footer__col--wide">
        <h4>Charge Updates</h4>
        <p>New stations, offers &amp; green-energy news. No spam.</p>
        <form class="footer__newsletter" action="form-handler.php" method="post">
          <input type="hidden" name="form_type" value="newsletter">
          <input type="text" name="company_website" value="" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label class="sr-only" for="nl-email">Email address</label>
          <input id="nl-email" type="email" name="email" placeholder="you@email.com" required>
          <button class="btn btn--primary" type="submit">Subscribe</button>
        </form>
      </div>
    </div>

    <div class="footer__bottom">
      <p>© <?= date('Y') ?> <?= e(SITE_NAME) ?> · <?= e(SITE_COMPANY) ?>. All rights reserved.</p>
      <p>Made in India 🇮🇳 · Driven by the sun ☀️</p>
    </div>
  </div>
</footer>

<script>
  /* Station data + config handed to JS (network page only). */
  window.ELECTRIVA = <?= json_encode([
      'page'     => current_page(),
      'stations' => $stations_json ?? null,
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
</script>
<?php if (!empty($use_map)): ?>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<?php endif; ?>
<script src="assets/js/main.js"></script>
</body>
</html>
