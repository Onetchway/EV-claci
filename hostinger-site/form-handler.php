<?php
/**
 * ============================================================
 *  ELECTRIVA — Form handler (contact / business / newsletter)
 *  ------------------------------------------------------------
 *  No database. Every submission is:
 *    1. validated + spam-checked (honeypot field)
 *    2. emailed to CONTACT_EMAIL via PHP mail()  — works on
 *       Hostinger out of the box
 *    3. appended to storage/leads.csv as a backup you can
 *       download from hPanel → File Manager
 *  Then the visitor is redirected back with a success message.
 * ============================================================
 */

require_once __DIR__ . '/includes/config.php';

/* Only accept POST — anything else goes home. */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: index.php');
    exit;
}

$type = $_POST['form_type'] ?? 'contact';

/* Where to send the visitor back to, per form. */
$back = [
    'contact'    => 'contact.php#contact-form',
    'business'   => 'business.php#partner-form',
    'newsletter' => 'index.php',
][$type] ?? 'contact.php';

/* ---------- Spam honeypot: real users never fill this hidden field ---------- */
if (trim($_POST['company_website'] ?? '') !== '') {
    // Pretend success so bots learn nothing.
    flash_set('success', 'Thank you! Your message has been received.');
    header('Location: ' . $back);
    exit;
}

/* ---------- Collect & trim ---------- */
$field = fn(string $key): string => trim((string) ($_POST[$key] ?? ''));

$data = [
    'name'    => mb_substr($field('name'), 0, 100),
    'company' => mb_substr($field('company'), 0, 150),
    'email'   => mb_substr($field('email'), 0, 150),
    'phone'   => mb_substr($field('phone'), 0, 30),
    'city'    => mb_substr($field('city'), 0, 100),
    'subject' => mb_substr($field('subject'), 0, 150),
    'message' => mb_substr($field('message'), 0, 3000),
];

/* ---------- Validate ---------- */
$errors = [];

if ($type === 'newsletter') {
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }
} else {
    if ($data['name'] === '')  $errors[] = 'Please enter your name.';
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
    if ($type === 'business' && $data['phone'] === '') $errors[] = 'Please enter your phone number.';
    if ($type === 'contact'  && $data['message'] === '') $errors[] = 'Please write a message.';
}

if ($errors) {
    $_SESSION['old'] = $data;                      // repopulate the form
    flash_set('error', implode(' ', $errors));
    header('Location: ' . $back);
    exit;
}
unset($_SESSION['old']);

/* ---------- Build the email ---------- */
$labels = [
    'contact'    => 'Contact form',
    'business'   => 'Business / partner enquiry',
    'newsletter' => 'Newsletter signup',
];
$label = $labels[$type] ?? 'Website form';

$subject = '[' . SITE_NAME . '] ' . $label . ($data['subject'] !== '' ? ' — ' . $data['subject'] : '');

$lines = ["New {$label} from the " . SITE_NAME . ' website', str_repeat('-', 46)];
foreach (['name' => 'Name', 'company' => 'Company', 'email' => 'Email',
          'phone' => 'Phone', 'city' => 'City', 'subject' => 'Topic'] as $key => $nice) {
    if ($data[$key] !== '') {
        $lines[] = sprintf('%-8s %s', $nice . ':', $data[$key]);
    }
}
if ($data['message'] !== '') {
    $lines[] = '';
    $lines[] = 'Message:';
    $lines[] = $data['message'];
}
$lines[] = '';
$lines[] = 'Sent: ' . date('d M Y, H:i') . ' (server time)';
$body = implode("\n", $lines);

/*
 * From: must be an address on YOUR domain for Hostinger to deliver
 * reliably (create noreply@yourdomain in hPanel → Emails).
 * Reply-To: the visitor, so you can just hit "Reply".
 */
$host      = strtolower(preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
$from_addr = 'noreply@' . (str_contains($host, '.') ? $host : 'example.com');

$headers = [
    'From: ' . SITE_NAME . ' Website <' . $from_addr . '>',
    'Reply-To: ' . ($data['name'] !== '' ? $data['name'] . ' <' . $data['email'] . '>' : $data['email']),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
];

$mailed = @mail(CONTACT_EMAIL, $subject, $body, implode("\r\n", $headers));

/* ---------- CSV backup (storage/ is blocked from the web by .htaccess) ---------- */
$csv = __DIR__ . '/storage/leads.csv';
$row = [date('Y-m-d H:i:s'), $type, $data['name'], $data['company'], $data['email'],
        $data['phone'], $data['city'], $data['subject'], $data['message'], $mailed ? 'mailed' : 'mail-failed'];

$fh = @fopen($csv, 'ab');
if ($fh !== false) {
    if (fstat($fh)['size'] === 0) {   // write a header row on first use
        fputcsv($fh, ['datetime', 'form', 'name', 'company', 'email', 'phone', 'city', 'subject', 'message', 'mail_status']);
    }
    fputcsv($fh, $row);
    fclose($fh);
}

/* ---------- Done ---------- */
flash_set('success', $type === 'newsletter'
    ? 'You\'re subscribed! Watch your inbox for charge updates. ⚡'
    : 'Thank you, ' . $data['name'] . '! Your message has been sent — we\'ll get back to you within one working day.');

header('Location: ' . $back);
exit;
