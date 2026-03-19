/**
 * OWASP VWAD - shared data and routing
 * Loads collection, assigns unique slugs, provides search and app-by-slug.
 */
(function () {
  'use strict';

  function slugify(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function assignSlugs(collection) {
    var seen = {};
    collection.forEach(function (app, i) {
      var base = slugify(app.name);
      var slug = base;
      var n = 1;
      while (seen[slug]) {
        n += 1;
        slug = base + '-' + n;
      }
      seen[slug] = true;
      app._slug = slug;
      app._index = i;
    });
    return collection;
  }

  var base = '';
  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
    var scriptUrl = document.currentScript.src;
    var dir = scriptUrl.slice(0, scriptUrl.lastIndexOf('/') + 1);
    base = dir.replace(/js\/?$/i, '');
  }
  if (!base && typeof window !== 'undefined' && window.VWAD_BASE) {
    base = window.VWAD_BASE + (window.VWAD_BASE ? '/' : '');
  }
  var collectionPromise = fetch(base + 'data/collection.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to load collection');
      return r.json();
    })
    .then(assignSlugs);

  function getAppBySlug(slug) {
    return collectionPromise.then(function (list) {
      return list.find(function (app) {
        return app._slug === slug;
      }) || null;
    });
  }

  function normalizeList(values) {
    return (values || []).map(function (value) {
      return String(value).toLowerCase();
    });
  }

  function matchesListFilter(appValues, selectedValues, mode) {
    if (!selectedValues || !selectedValues.length) return true;
    var normalizedAppValues = normalizeList(appValues);
    var normalizedSelectedValues = normalizeList(selectedValues);
    if (mode === 'and') {
      return normalizedSelectedValues.every(function (value) {
        return normalizedAppValues.indexOf(value) !== -1;
      });
    }
    return normalizedSelectedValues.some(function (value) {
      return normalizedAppValues.indexOf(value) !== -1;
    });
  }

  function getAppYear(app) {
    if (!app || !app.last_contributed) return null;
    var dateValue = new Date(app.last_contributed);
    if (isNaN(dateValue.getTime())) return null;
    return dateValue.getUTCFullYear();
  }

  function searchApps(query, filters) {
    query = (query || '').toLowerCase().trim();
    filters = filters || {};
    return collectionPromise.then(function (list) {
      var filtered = list.filter(function (app) {
        var appRefs = (app.references || []).map(function (ref) {
          return ref && ref.name;
        });
        var appStars = app.stars != null ? Number(app.stars) : null;
        var appYear = getAppYear(app);

        if (!matchesListFilter(app.collection, filters.collection, filters.collectionMode || 'or')) return false;
        if (!matchesListFilter(app.technology, filters.technology, filters.technologyMode || 'or')) return false;
        if (!matchesListFilter(app.categories, filters.categories, filters.categoriesMode || 'or')) return false;
        if (!matchesListFilter(appRefs, filters.references, filters.referencesMode || 'or')) return false;

        if (filters.stars) {
          if (filters.stars === 'none') {
            if (appStars != null && !isNaN(appStars) && appStars > 0) return false;
          } else {
            var minimumStars = Number(filters.stars);
            if (isNaN(minimumStars)) return false;
            if (appStars == null || isNaN(appStars) || appStars < minimumStars) return false;
          }
        }

        if (filters.yearFrom) {
          var yearFrom = Number(filters.yearFrom);
          if (!appYear || isNaN(yearFrom) || appYear < yearFrom) return false;
        }

        if (filters.yearTo) {
          var yearTo = Number(filters.yearTo);
          if (!appYear || isNaN(yearTo) || appYear > yearTo) return false;
        }

        if (!query) return true;
        var searchable = [
          app.name,
          app.author
        ].join(' ').toLowerCase();
        return searchable.indexOf(query) !== -1;
      });
      return { apps: filtered, total: list.length };
    });
  }

  function getPathSlug() {
    var pathname = window.location.pathname || '';
    var parts = pathname.split('app/');
    if (parts.length >= 2) {
      var after = (parts[1].replace(/\/$/, '') || '').split('/')[0];
      if (after && after !== 'html') return after;
    }
    if (window.location.hash) return window.location.hash.replace(/^#/, '').trim() || null;
    return null;
  }

  /** Returns { label, slug } for last_contributed age band; null if no/invalid date. */
  function getUpdatedBand(isoDate) {
    if (!isoDate) return null;
    var then = new Date(isoDate).getTime();
    if (isNaN(then)) return null;
    var days = (Date.now() - then) / (24 * 60 * 60 * 1000);
    if (days < 30) return { label: '< 1mo', slug: 'lt1mo' };
    if (days < 30 * 6) return { label: '< 6mo', slug: 'lt6mo' };
    if (days < 365) return { label: '< 1y', slug: 'lt1y' };
    if (days < 365 * 2) return { label: '< 2y', slug: 'lt2y' };
    return { label: '2y +', slug: '2y' };
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function toTitleCase(s) {
    if (s == null || s === '') return '';
    return String(s).replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Tooltips for collection and category pills (table + detail). Shown on hover/focus via title attribute.
  var COLLECTION_TOOLTIPS = {
    online: 'Hosted online; use over the internet',
    offline: 'Download and run locally',
    mobile: 'Mobile app (e.g. Android, iOS)',
    container: 'Containerized (Docker, VMs, ISOs)',
    platform: 'Platform or multi-app environment'
  };
  var CATEGORY_TOOLTIPS = {
    ctf: 'Capture the Flag challenge',
    'code-review': 'Code review practice',
    'single-player': 'Single-player',
    'multi-player': 'Multi-player',
    'guided-lessons': 'Guided lessons',
    'free-form': 'Free-form practice',
    'scanner-test': 'Scanner or tool testing'
  };

  // Reference name (from collection.json references[].name) → icon symbol id for the SVG sprite (ICON_SPRITE). Add new ref types here and add a matching <symbol id="icon-..."> below.
  var REF_ICON_MAP = {
    guide: 'guide',
    download: 'download',
    docker: 'docker',
    announcement: 'announcement',
    live: 'live',
    demo: 'demo',
    preview: 'preview'
  };
  // Returns sprite symbol id for ref.name; used in renderApp as <use href="#icon-{id}"/>.
  function getRefIconId(name) {
    if (name == null || name === '') return 'fallback';
    var id = REF_ICON_MAP[String(name).toLowerCase()];
    return id || 'fallback';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  /**
   * Renders a single app as HTML (same layout as detail page).
   * options.backLink: true = "← Back to directory", 'slug' = "View full details" link to app/#slug, false/omit = no link
   * options.titleLink: 'slug' = wrap title in <a href="app/#{slug}"> (e.g. featured app → detail page)
   */
  function renderApp(app, options) {
    if (!app || typeof app !== 'object') return '';
    options = options || {};
    var html = '<article class="app-detail">';
    var titleText = escapeHtml(app.name || '');
    if (options.titleLink === 'slug' && app._slug) {
      var detailUrl = (typeof window !== 'undefined' && window.VWAD_BASE ? window.VWAD_BASE + '/' : '') + 'app/#' + escapeHtml(app._slug);
      html += '<h1 class="app-detail-title"><a href="' + detailUrl + '">' + titleText + '</a></h1>';
    } else {
      html += '<h1 class="app-detail-title">' + titleText + '</h1>';
    }

    if (app.description && app.description.trim()) {
      html += '<div class="app-detail-description"><p>' + escapeHtml(app.description.trim()) + '</p></div>';
    }

    html += '<div class="app-detail-meta">';
    if (app.collection && app.collection.length) {
      html += '<div class="app-detail-row"><span class="label">Collections</span> ';
      html += app.collection.map(function (c) {
        var title = COLLECTION_TOOLTIPS[c];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        return '<span class="pill pill-collection"' + titleAttr + '>' + escapeHtml(c) + '</span>';
      }).join(' ');
      html += '</div>';
    }
    if (app.technology && app.technology.length) {
      html += '<div class="app-detail-row"><span class="label">Technology</span> ';
      html += app.technology.map(function (t) {
        return '<span class="pill">' + escapeHtml(t) + '</span>';
      }).join(' ');
      html += '</div>';
    }
    if (app.categories && app.categories.length) {
      html += '<div class="app-detail-row"><span class="label">Categories</span> ';
      html += app.categories.map(function (c) {
        var label = c === 'ctf' ? 'CTF' : c;
        var title = CATEGORY_TOOLTIPS[c];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        return '<span class="pill pill-category"' + titleAttr + '>' + escapeHtml(label) + '</span>';
      }).join(' ');
      html += '</div>';
    }
    if (app.author) {
      html += '<div class="app-detail-row"><span class="label">Author</span> ' + escapeHtml(app.author) + '</div>';
    }
    if (app.stars != null) {
      var starsCount = String(app.stars);
      var badgeUrl = 'https://img.shields.io/badge/stars-' + encodeURIComponent(starsCount) + '-007ec6?style=flat';
      html += '<div class="app-detail-row"><span class="label">Stars</span> ';
      html += '<img class="app-detail-stars-badge" src="' + escapeHtml(badgeUrl) + '" alt="' + escapeHtml(starsCount) + ' stars" loading="lazy"></div>';
    }
    if (app.last_contributed) {
      var band = getUpdatedBand(app.last_contributed);
      var pill = band ? ' <span class="pill pill-updated pill-updated-' + escapeHtml(band.slug) + '">' + escapeHtml(band.label) + '</span>' : '';
      html += '<div class="app-detail-row"><span class="label">Last contribution</span> ' + escapeHtml(formatDate(app.last_contributed)) + pill + '</div>';
    }
    html += '</div>';

    // Action buttons: Link uses #icon-link; each reference uses getRefIconId(ref.name) → #icon-{id} from sprite.
    html += '<div class="app-detail-links">';
    html += '<a href="' + escapeHtml(app.url || '#') + '" class="btn btn-primary" target="_blank" rel="noopener"><svg class="btn-icon" aria-hidden="true"><use href="#icon-link"/></svg> Link</a>';
    if (app.references && app.references.length) {
      app.references.forEach(function (ref) {
        var iconId = getRefIconId(ref.name);
        html += ' <a href="' + escapeHtml(ref.url) + '" class="btn btn-secondary" target="_blank" rel="noopener"><svg class="btn-icon" aria-hidden="true"><use href="#icon-' + escapeHtml(iconId) + '"/></svg> ' + escapeHtml(toTitleCase(ref.name)) + '</a>';
      });
    }
    html += '</div>';

    if (app.notes) {
      html += '<div class="app-detail-notes"><h2>Notes</h2><p>' + escapeHtml(app.notes) + '</p></div>';
    }

    if (options.backLink === true) {
      var base = (typeof window !== 'undefined' && window.VWAD_BASE) ? window.VWAD_BASE + '/' : './';
      html += '<p class="app-detail-back"><a href="' + base + '">← Back to directory</a></p>';
    } else if (options.backLink === 'slug' && app._slug) {
      var appUrl = (typeof window !== 'undefined' && window.VWAD_BASE ? window.VWAD_BASE + '/' : '') + 'app/#' + escapeHtml(app._slug);
      html += '<p class="app-detail-back"><a href="' + appUrl + '">View full details</a></p>';
    }
    html += '</article>';
    return html;
  }

  /* SVG icon sprite for app detail/feature buttons. Injected once into document.body; buttons reference symbols via <use href="#icon-{id}"/>. Symbol ids must match REF_ICON_MAP + "link" and "fallback". Icon styling: .app-detail-links .btn-icon in css/app-detail.css. */
  var ICON_SPRITE = '<svg id="vwad-icon-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
    '<defs>' +
    '<symbol id="icon-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>' +
    '<symbol id="icon-download" viewBox="2 2 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>' +
    '<symbol id="icon-guide" viewBox="3 1 18 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></symbol>' +
    '<symbol id="icon-docker" viewBox="0.5 0.5 23.5 23.5"><path fill="currentColor" d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/></symbol>' +
    '<symbol id="icon-announcement" viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M19.64 25.98s24.79 1.289 40-9.142"/><path d="M19.64 44.88s24.79-1.289 40 9.142"/><path d="M12.85 25.98h6.787v18.63h-6.787c-1.105 0-2-.895-2-2v-14.63c0-1.105.895-2 2-2z"/><rect x="59.64" y="15.29" width="6" height="40.01" rx="2" ry="2"/><path d="M19.636 44.92l.877 4.648h-1.5l1.564 8.299h.5l.38 2.016-5.475.076-2.835-15.04"/><path d="M10.85 28.79h-2.485c-1.105 0-2 .895-2 2v8.922c0 1.105.895 2 2 2h2.485"/><line x1="13.64" y1="41" x2="16.64" y2="41"/></symbol>' +
    '<symbol id="icon-live" viewBox="1 1 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>' +
    '<symbol id="icon-demo" viewBox="7 4 13 16" fill="currentColor"><path d="M8 5v14l11-7z"/></symbol>' +
    '<symbol id="icon-preview" viewBox="0 3 24 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></symbol>' +
    '<symbol id="icon-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>' +
    '</defs></svg>';
  if (typeof document !== 'undefined' && document.body && !document.getElementById('vwad-icon-sprite')) {
    document.body.insertAdjacentHTML('afterbegin', ICON_SPRITE);
  }

  window.VWAD = {
    getCollection: function () {
      return collectionPromise;
    },
    getAppBySlug: getAppBySlug,
    searchApps: searchApps,
    getPathSlug: getPathSlug,
    getUpdatedBand: getUpdatedBand,
    renderApp: renderApp,
    slugify: slugify,
    COLLECTION_TOOLTIPS: COLLECTION_TOOLTIPS,
    CATEGORY_TOOLTIPS: CATEGORY_TOOLTIPS
  };
})();
