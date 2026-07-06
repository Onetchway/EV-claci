<?php
$page_title = 'FAQ — EV Charging Questions Answered | Electriva';
$page_desc  = 'Answers to common questions about charging on the Electriva network: connectors, payments, pricing, the app, memberships and business partnerships.';
require __DIR__ . '/includes/header.php';

/* Edit questions here — the page renders from this array. */
$faq_groups = [
    'Charging basics' => [
        ['q' => 'Which vehicles can charge on the Electriva network?',
         'a' => 'All of them — electric cars, 2-wheelers, 3-wheelers, commercial fleets and e-buses. Our stations offer CCS2 and CHAdeMO DC guns, Type 2 and 3-pin AC sockets, plus dedicated battery-swap docks for 2W/3W.'],
        ['q' => 'How long does a charge take?',
         'a' => 'On a DC Ultra charger (120–240 kW), most cars add about 250 km of range in roughly 20 minutes. DC Fast (30–60 kW) tops up 20→80% in 45–60 minutes. AC charging (3.3–22 kW) is designed for longer parking — overnight or a workday.'],
        ['q' => 'Do I need to bring my own cable?',
         'a' => 'For DC charging, no — the gun and cable are attached to the charger. For AC Type 2 points, most Indian EVs use the portable cable that came with the vehicle; 3-pin sockets work with your standard charger brick.'],
        ['q' => 'Is fast charging safe for my battery?',
         'a' => 'Yes. The charger and your car negotiate the maximum safe power every second; the car is always in control. For daily use we recommend a mix of AC and DC charging, which is exactly how our network is designed.'],
    ],
    'Payments & pricing' => [
        ['q' => 'How do I pay?',
         'a' => 'UPI (scan the QR at the charger or pay in-app), credit/debit cards, netbanking, or the prepaid Electriva Wallet with auto-pay. Fleet customers get consolidated monthly billing.'],
        ['q' => 'What does charging cost?',
         'a' => 'Simple per-kWh rates: AC from ₹15/kWh, DC Fast from ₹19/kWh, DC Ultra ₹22/kWh, battery swaps from ₹99. The exact rate is always shown in the app before you start, and every session ends with a GST invoice.'],
        ['q' => 'Are there any hidden fees — parking, idle time, connection charges?',
         'a' => 'No connection fees, ever. Parking is free while charging at Electriva-operated sites. To keep guns available, an idle fee may apply if a car stays plugged in more than 15 minutes after charging completes — the app warns you well before.'],
        ['q' => 'What is Electriva Prime?',
         'a' => 'Our membership at ₹199/month (or ₹1,999/year): 10% off every session, free DC Ultra bay reservations, a priority support line and partner offers at station cafés.'],
    ],
    'App & account' => [
        ['q' => 'Do I need the app to charge?',
         'a' => 'No — you can scan the QR on any charger and pay as a guest with UPI. The app just makes life better: live availability, reservations, session history, invoices and wallet auto-pay.'],
        ['q' => 'Can I see if a charger is free before driving there?',
         'a' => 'Yes. The app and the network map show live gun-by-gun availability, so you never drive to a busy or offline charger.'],
        ['q' => 'How do I report a problem with a charger?',
         'a' => 'Tap "Report an issue" in the app, message us on WhatsApp, or call the 24×7 helpline printed on every charger. Our remote team can restart most chargers within minutes.'],
    ],
    'Business & partnerships' => [
        ['q' => 'I have land / parking — how do I get a station?',
         'a' => 'Request a free site assessment on our For Business page. Under the CoCo model we fund and operate everything while you earn rent plus a revenue share; franchise and PoCo models are available if you want to invest.'],
        ['q' => 'How much does a franchise cost?',
         'a' => 'Formats start around ₹8 lakh for AC-focused sites and go up to ₹40 lakh for DC highway hubs. That includes hardware, installation, branding, software and training — our team shares detailed unit economics during assessment.'],
        ['q' => 'Do you electrify delivery fleets?',
         'a' => 'Yes — depot charging, public-network fleet wallets and battery swapping for 2W/3W fleets. Riders swap in about 60 seconds at 1000+ stations.'],
        ['q' => 'Which regions do you cover?',
         'a' => 'We operate across 17+ Indian states and Nepal, in 35+ cities, and we expand every quarter. If we\'re not in your city yet, a strong site can be the reason we arrive.'],
    ],
];
?>

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Help centre</span>
    <h1>Frequently asked <span class="grad">questions</span></h1>
    <p class="lede">Everything drivers and partners ask us — answered straight.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container faq-wrap">
    <?php foreach ($faq_groups as $group => $items): ?>
    <div class="faq-group reveal">
      <h2 class="faq-group__title"><?= e($group) ?></h2>
      <?php foreach ($items as $item): ?>
      <details class="faq">
        <summary><?= e($item['q']) ?><span class="faq__icon" aria-hidden="true">+</span></summary>
        <p><?= e($item['a']) ?></p>
      </details>
      <?php endforeach; ?>
    </div>
    <?php endforeach; ?>

    <div class="net-help__cta faq-more reveal">
      <h3>Still have a question?</h3>
      <p>Our team answers 24×7 on phone and WhatsApp, and within a working day on email.</p>
      <a class="btn btn--primary" href="contact.php">Contact Support</a>
    </div>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
