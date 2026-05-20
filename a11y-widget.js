(function () {
  'use strict';

  var STORAGE_KEY = 'lekhatchila-a11y';
  var defaults = {
    contrast: false,
    grayscale: false,
    links: false,
    readable: false,
    stopMotion: false,
    fontSize: 0
  };
  var settings = Object.assign({}, defaults);

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) {}
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function apply() {
    var b = document.body;
    b.classList.toggle('a11y-contrast', settings.contrast);
    b.classList.toggle('a11y-grayscale', settings.grayscale);
    b.classList.toggle('a11y-links', settings.links);
    b.classList.toggle('a11y-readable', settings.readable);
    b.classList.toggle('a11y-stop-motion', settings.stopMotion);

    for (var i = -2; i <= 5; i++) {
      if (i === 0) continue;
      b.classList.remove('a11y-font-' + (i > 0 ? 'plus' + i : 'minus' + Math.abs(i)));
    }
    if (settings.fontSize > 0) b.classList.add('a11y-font-plus' + settings.fontSize);
    if (settings.fontSize < 0) b.classList.add('a11y-font-minus' + Math.abs(settings.fontSize));

    document.querySelectorAll('[data-a11y-toggle]').forEach(function (btn) {
      var k = btn.dataset.a11yToggle;
      btn.setAttribute('aria-pressed', settings[k] ? 'true' : 'false');
    });
    var lvl = document.getElementById('a11y-font-level');
    if (lvl) lvl.textContent = settings.fontSize;
  }

  function reset() {
    Object.assign(settings, defaults);
    save(); apply();
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'a11y-widget';
    wrap.dir = 'rtl';
    wrap.innerHTML =
      '<button class="a11y-fab" type="button" aria-label="פתיחת תפריט נגישות" aria-expanded="false" aria-controls="a11y-panel">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<circle cx="12" cy="3.5" r="2" fill="currentColor"/>' +
          '<path fill="currentColor" d="M20.5 7.5h-17a1 1 0 0 0 0 2H9v3.2L7.05 20.7a1 1 0 0 0 1.9.6L10.5 16h3l1.55 5.3a1 1 0 0 0 1.9-.6L15 12.7V9.5h5.5a1 1 0 0 0 0-2z"/>' +
        '</svg>' +
      '</button>' +
      '<div id="a11y-panel" class="a11y-panel" role="dialog" aria-labelledby="a11y-title" aria-modal="false" hidden>' +
        '<div class="a11y-panel-header">' +
          '<h2 id="a11y-title">תפריט נגישות</h2>' +
          '<button class="a11y-close" type="button" aria-label="סגירת תפריט נגישות">&times;</button>' +
        '</div>' +
        '<div class="a11y-panel-body">' +
          '<div class="a11y-font-controls" role="group" aria-label="שינוי גודל גופן">' +
            '<span class="a11y-font-label">גודל גופן</span>' +
            '<button class="a11y-font-btn" type="button" data-a11y-font="minus" aria-label="הקטנת גופן">−</button>' +
            '<span id="a11y-font-level" class="a11y-font-level" aria-live="polite">0</span>' +
            '<button class="a11y-font-btn" type="button" data-a11y-font="plus" aria-label="הגדלת גופן">+</button>' +
          '</div>' +
          '<button class="a11y-opt" type="button" data-a11y-toggle="contrast" aria-pressed="false">' +
            '<span class="a11y-opt-icon" aria-hidden="true">◐</span><span>ניגודיות גבוהה</span></button>' +
          '<button class="a11y-opt" type="button" data-a11y-toggle="grayscale" aria-pressed="false">' +
            '<span class="a11y-opt-icon" aria-hidden="true">▣</span><span>גווני אפור</span></button>' +
          '<button class="a11y-opt" type="button" data-a11y-toggle="links" aria-pressed="false">' +
            '<span class="a11y-opt-icon" aria-hidden="true">⎘</span><span>הדגשת קישורים</span></button>' +
          '<button class="a11y-opt" type="button" data-a11y-toggle="readable" aria-pressed="false">' +
            '<span class="a11y-opt-icon" aria-hidden="true">Aa</span><span>גופן קריא</span></button>' +
          '<button class="a11y-opt" type="button" data-a11y-toggle="stopMotion" aria-pressed="false">' +
            '<span class="a11y-opt-icon" aria-hidden="true">⏸</span><span>עצירת אנימציות</span></button>' +
          '<button class="a11y-reset" type="button" data-a11y-action="reset">איפוס הגדרות</button>' +
        '</div>' +
        '<div class="a11y-panel-footer">' +
          '<a href="negishut.html">הצהרת נגישות</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    var fab = wrap.querySelector('.a11y-fab');
    var panel = wrap.querySelector('.a11y-panel');
    var closeBtn = wrap.querySelector('.a11y-close');

    function open() {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
      closeBtn.focus();
    }
    function close() {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
      fab.focus();
    }
    fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
    closeBtn.addEventListener('click', close);

    wrap.querySelectorAll('[data-a11y-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.a11yToggle;
        settings[k] = !settings[k];
        save(); apply();
      });
    });

    wrap.querySelectorAll('[data-a11y-font]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.dataset.a11yFont;
        if (dir === 'plus' && settings.fontSize < 5) settings.fontSize++;
        if (dir === 'minus' && settings.fontSize > -2) settings.fontSize--;
        save(); apply();
      });
    });

    wrap.querySelector('[data-a11y-action="reset"]').addEventListener('click', reset);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) close();
    });
  }

  function init() {
    load();
    build();
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
