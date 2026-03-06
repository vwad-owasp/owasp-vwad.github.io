/**
 * Renders a single app on the app page.
 */
(function () {
  'use strict';

  function show(el) {
    if (el) el.classList.remove('hidden');
  }
  function hide(el) {
    if (el) el.classList.add('hidden');
  }

  var appView = document.getElementById('app-view');
  var notFound = document.getElementById('not-found');
  var noSlug = document.getElementById('no-slug');
  var loading = document.getElementById('loading');

  var slug = window.VWAD.getPathSlug();
  if (!slug) {
    hide(loading);
    hide(appView);
    show(noSlug || notFound);
    return;
  }

  /* Path looks like /app/<slug> or app.html#slug: show loading, hide 404/no-slug and app view until we know if app exists. */
  hide(notFound);
  hide(noSlug);
  hide(appView);
  show(loading);

  window.VWAD.getAppBySlug(slug).then(function (app) {
    hide(loading);
    if (app) {
      document.title = app.name + ' - OWASP VWAD';
      appView.innerHTML = window.VWAD.renderApp(app, { backLink: true });
      show(appView);
      hide(notFound);
      hide(noSlug);
    } else {
      show(notFound || noSlug);
      hide(appView);
    }
  }).catch(function () {
    hide(loading);
    show(notFound || noSlug);
    hide(appView);
  });
})();
