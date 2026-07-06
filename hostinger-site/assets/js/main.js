/* ===================================================================
   ELECTRIVA — site behaviour (no frameworks, no build step)
   =================================================================== */
(function () {
  'use strict';

  var CFG = window.ELECTRIVA || {};

  /* ---------- Sticky nav state ---------- */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Auto-dismiss flash toast ---------- */
  var toast = document.getElementById('toast');
  if (toast) {
    setTimeout(function () {
      toast.style.transition = 'opacity .5s';
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 550);
    }, 6000);
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var numEl = (el.classList.contains('stat__num') || el.tagName === 'STRONG' || el.tagName === 'SPAN')
      ? el
      : el.querySelector('.stat__num, strong');
    if (!numEl) numEl = el;
    var dur = 1600;
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      numEl.textContent = Math.round(target * eased).toLocaleString('en-IN') + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var countEls = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && countEls.length) {
    var countObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    countEls.forEach(function (el) { countObs.observe(el); });
  } else {
    countEls.forEach(animateCount);
  }

  /* ===================================================================
     Network page: filters + Leaflet map
     =================================================================== */
  var list = document.getElementById('stationList');
  if (!list) return;                        // everything below is network-page only

  var stations = CFG.stations || [];
  var search = document.getElementById('stationSearch');
  var citySel = document.getElementById('cityFilter');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var countEl = document.getElementById('stationCount');
  var emptyEl = document.getElementById('stationEmpty');
  var cards = Array.prototype.slice.call(list.querySelectorAll('.station'));
  var activeType = '';

  /* ----- Map (graceful: cards work even if Leaflet/CDN fails) ----- */
  var map = null;
  var markers = {};
  var mapEl = document.getElementById('stationMap');

  if (mapEl && typeof L !== 'undefined' && stations.length) {
    map = L.map('stationMap', { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var pin = L.divIcon({
      className: '',
      html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
            'background:linear-gradient(135deg,#2ee88e,#12b76a);border:2px solid #fff;' +
            'box-shadow:0 4px 12px rgba(6,78,59,.5);display:grid;place-items:center;">' +
            '<span style="transform:rotate(45deg);font-size:13px;">⚡</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });

    stations.forEach(function (s) {
      var m = L.marker([s.lat, s.lng], { icon: pin }).addTo(map);
      m.bindPopup(
        '<div class="map-pop"><strong>' + s.name + '</strong>' +
        '<span>' + s.type + ' · ' + s.power + ' · ' + s.status + '</span><br>' +
        '<a href="https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lng +
        '" target="_blank" rel="noopener">Get directions →</a></div>'
      );
      markers[s.id] = m;
    });

    fitVisible();
  } else if (mapEl) {
    mapEl.innerHTML = '<p class="map-fallback">Map unavailable right now — all stations are listed alongside.</p>';
  }

  function fitVisible() {
    if (!map) return;
    var pts = [];
    cards.forEach(function (card) {
      if (card.hidden) return;
      var s = findStation(card.getAttribute('data-id'));
      if (s) pts.push([s.lat, s.lng]);
    });
    if (pts.length) {
      map.fitBounds(pts, { padding: [42, 42], maxZoom: 13 });
    }
  }

  function findStation(id) {
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].id === id) return stations[i];
    }
    return null;
  }

  /* ----- Filtering ----- */
  function applyFilters() {
    var q = (search && search.value ? search.value : '').toLowerCase().trim();
    var city = citySel ? citySel.value : '';
    var visible = 0;

    cards.forEach(function (card) {
      var show =
        (!q || card.getAttribute('data-search').indexOf(q) !== -1) &&
        (!city || card.getAttribute('data-city') === city) &&
        (!activeType || card.getAttribute('data-type') === activeType);
      card.hidden = !show;
      if (show) visible++;

      var m = markers[card.getAttribute('data-id')];
      if (m && map) {
        if (show && !map.hasLayer(m)) map.addLayer(m);
        if (!show && map.hasLayer(m)) map.removeLayer(m);
      }
    });

    if (countEl) countEl.textContent = visible + (visible === 1 ? ' station' : ' stations');
    if (emptyEl) emptyEl.hidden = visible !== 0;
    fitVisible();
  }

  if (search) search.addEventListener('input', applyFilters);
  if (citySel) citySel.addEventListener('change', applyFilters);
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeType = chip.getAttribute('data-type') || '';
      applyFilters();
    });
  });

  /* ----- "View on Map" buttons ----- */
  document.querySelectorAll('.js-map-focus').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var s = findStation(id);
      if (!s) return;

      if (map && markers[id]) {
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        map.setView([s.lat, s.lng], 14, { animate: true });
        markers[id].openPopup();
      } else {
        window.open('https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lng, '_blank');
      }

      cards.forEach(function (c) { c.classList.remove('highlight'); });
      var card = list.querySelector('.station[data-id="' + id + '"]');
      if (card) card.classList.add('highlight');
    });
  });
})();
