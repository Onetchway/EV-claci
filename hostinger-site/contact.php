<?php
$page_title = 'Contact Us — 24×7 EV Charging Support | Electriva';
$page_desc  = 'Reach Electriva: 24×7 driver support on phone and WhatsApp, partnership enquiries, media and careers. We respond within one working day.';
require __DIR__ . '/includes/header.php';
?>

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Contact</span>
    <h1>Talk to a <span class="grad">human</span></h1>
    <p class="lede">Stuck at a charger? Exploring a partnership? We answer — fast, 24×7.</p>
  </div>
</section>

<!-- ═══════════════ Contact channels ═══════════════ -->
<section class="section section--tight">
  <div class="container">
    <div class="cards-3 cards-3--slim">
      <article class="card card--center reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z"/></svg></div>
        <h3>24×7 Helpline</h3>
        <p>Charging emergencies &amp; support</p>
        <a class="btn btn--ghost" href="tel:<?= e(preg_replace('/\s+/', '', CONTACT_PHONE)) ?>"><?= e(CONTACT_PHONE) ?></a>
      </article>
      <article class="card card--center reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.5-.7L3 21l1.8-5.5a8.4 8.4 0 1 1 16.2-4z"/></svg></div>
        <h3>WhatsApp</h3>
        <p>Chat with support instantly</p>
        <a class="btn btn--ghost" href="https://wa.me/<?= e(CONTACT_WHATSAPP) ?>" target="_blank" rel="noopener">Message Us</a>
      </article>
      <article class="card card--center reveal">
        <div class="card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg></div>
        <h3>Email</h3>
        <p>Partnerships, media &amp; careers</p>
        <a class="btn btn--ghost" href="mailto:<?= e(CONTACT_EMAIL) ?>"><?= e(CONTACT_EMAIL) ?></a>
      </article>
    </div>
  </div>
</section>

<!-- ═══════════════ Form + info ═══════════════ -->
<section class="section section--alt" id="contact-form">
  <div class="container form-split">
    <div class="form-split__copy reveal">
      <span class="eyebrow eyebrow--dark">Send a message</span>
      <h2 class="h2--ink">We reply within one working day</h2>
      <p>For urgent charging issues, always use the 24×7 helpline or WhatsApp — it's faster.</p>

      <div class="addr-card">
        <h3>Registered Office</h3>
        <p><?= e(SITE_NAME) ?> · <?= e(SITE_COMPANY) ?></p>
        <p><?= e(CONTACT_ADDRESS) ?></p>
        <p><strong><?= e(SUPPORT_HOURS) ?></strong></p>
      </div>
    </div>

    <form class="form form--light reveal" action="form-handler.php" method="post" novalidate>
      <input type="hidden" name="form_type" value="contact">
      <input type="text" name="company_website" value="" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">

      <div class="form__row">
        <div class="form__field">
          <label for="c-name">Your name *</label>
          <input id="c-name" type="text" name="name" value="<?= old('name') ?>" required>
        </div>
        <div class="form__field">
          <label for="c-phone">Phone</label>
          <input id="c-phone" type="tel" name="phone" value="<?= old('phone') ?>">
        </div>
      </div>

      <div class="form__row">
        <div class="form__field">
          <label for="c-email">Email *</label>
          <input id="c-email" type="email" name="email" value="<?= old('email') ?>" required>
        </div>
        <div class="form__field">
          <label for="c-subject">Topic</label>
          <select id="c-subject" name="subject">
            <option>General enquiry</option>
            <option>Charging support</option>
            <option>Request a station in my city</option>
            <option>Partnership / business</option>
            <option>Media &amp; press</option>
            <option>Careers</option>
          </select>
        </div>
      </div>

      <div class="form__field">
        <label for="c-message">Message *</label>
        <textarea id="c-message" name="message" rows="5" required placeholder="How can we help?"><?= old('message') ?></textarea>
      </div>

      <button class="btn btn--primary btn--lg" type="submit">Send Message</button>
      <p class="form__privacy">We only use your details to answer this enquiry. No spam, ever.</p>
    </form>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
