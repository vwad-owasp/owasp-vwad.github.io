/**
 * Home page: browse all apps, search by any criteria, link to app pages
 */
(function () {
  'use strict';

  var COLLECTIONS = ['online', 'offline', 'mobile', 'container', 'platform'];

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getAppUrl(app) {
    return 'app/#' + (app._slug || '');
  }

  function sortApps(apps, sortBy, sortDir) {
    if (!sortBy || !sortDir || !apps.length) return apps.slice();
    var mult = sortDir === 'desc' ? -1 : 1;
    return apps.slice().sort(function (a, b) {
      var va, vb;
      if (sortBy === 'name') {
        va = (a.name || '').toLowerCase();
        vb = (b.name || '').toLowerCase();
        return mult * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      if (sortBy === 'stars') {
        va = a.stars != null ? Number(a.stars) : -1;
        vb = b.stars != null ? Number(b.stars) : -1;
        return mult * (va - vb);
      }
      if (sortBy === 'updated') {
        va = a.last_contributed ? new Date(a.last_contributed).getTime() : 0;
        vb = b.last_contributed ? new Date(b.last_contributed).getTime() : 0;
        return mult * (va - vb);
      }
      return 0;
    });
  }

  function renderTable(apps, sortState, options) {
    if (!apps.length) {
      return '<p class="muted">No applications match.</p>';
    }
    options = options || {};
    var query = (options.query || '').toLowerCase().trim();
    var sortBy = sortState && sortState.column;
    var sortDir = sortState && sortState.dir;
    var th = function (key, label) {
      var isSortable = key === 'name' || key === 'stars' || key === 'updated';
      if (!isSortable) return '<th>' + escapeHtml(label) + '</th>';
      var ariaSort = sortBy === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      var cls = 'sortable' + (sortBy === key ? ' sorted-' + sortDir : '');
      return '<th class="' + cls + '" scope="col" data-sort="' + escapeHtml(key) + '" aria-sort="' + ariaSort + '"><button type="button">' + escapeHtml(label) + '</button></th>';
    };
    var clearSortHtml = sortState
      ? '<caption class="table-toolbar"><div class="table-toolbar-row"><button type="button" class="sort-clear">Clear sort</button></div></caption>'
      : '';
    var html = '<div class="table-scroll-outer"><div class="table-wrap"><table class="apps-table">' + clearSortHtml + '<thead><tr>';
    html += th('name', 'Name') + '<th>Collections</th><th>Tech &amp; categories</th>' + th('stars', 'Stars') + th('updated', 'Updated');
    html += '</tr></thead><tbody>';
    apps.forEach(function (app) {
      var url = getAppUrl(app);
      var updatedBand = window.VWAD && window.VWAD.getUpdatedBand ? window.VWAD.getUpdatedBand(app.last_contributed) : null;
      var updatedCell = updatedBand
        ? '<span class="pill pill-updated pill-updated-' + escapeHtml(updatedBand.slug) + '" title="Last contribution">' + escapeHtml(updatedBand.label) + '</span>'
        : '-';
      var authorMatched = query && app.author && app.author.toLowerCase().indexOf(query) !== -1;
      var nameCell = '<a href="' + escapeHtml(url) + '">' + escapeHtml(app.name) + '</a>';
      if (authorMatched) {
        nameCell += ' <span class="author-match" title="Matched by author">Author: ' + escapeHtml(app.author) + '</span>';
      }
      html += '<tr>';
      html += '<td>' + nameCell + '</td>';
      var collTitles = window.VWAD && window.VWAD.COLLECTION_TOOLTIPS ? window.VWAD.COLLECTION_TOOLTIPS : {};
      var catTitles = window.VWAD && window.VWAD.CATEGORY_TOOLTIPS ? window.VWAD.CATEGORY_TOOLTIPS : {};
      html += '<td>' + (app.collection || []).map(function (c) {
        var title = collTitles[c];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        var label = c.charAt(0).toUpperCase() + c.slice(1);
        return '<button type="button" class="pill pill-collection pill-filter" data-filter-type="collection" data-filter-value="' + escapeHtml(c) + '" aria-label="Filter by collection: ' + escapeHtml(label) + '"' + titleAttr + '>' + escapeHtml(c) + '</button>';
      }).join(' ') + '</td>';
      var tech = (app.technology || []).map(function (t) {
        return '<button type="button" class="pill pill-technology pill-filter" data-filter-type="technology" data-filter-value="' + escapeHtml(t) + '" aria-label="Filter by technology: ' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
      }).join(' ');
      var categories = (app.categories || []).map(function (c) {
        var label = c === 'ctf' ? 'CTF' : c;
        var title = catTitles[c];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        return '<button type="button" class="pill pill-category pill-filter" data-filter-type="category" data-filter-value="' + escapeHtml(c) + '" aria-label="Filter by category: ' + escapeHtml(label) + '"' + titleAttr + '>' + escapeHtml(label) + '</button>';
      }).join(' ');
      html += '<td>' + tech + (tech && categories ? ' ' : '') + categories + '</td>';
      html += '<td>' + (app.stars != null ? escapeHtml(String(app.stars)) : '-') + '</td>';
      html += '<td>' + updatedCell + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function initSearch() {
    var searchInput = document.getElementById('search-input');
    var collectionSelect = document.getElementById('filter-collection');
    var techInput = document.getElementById('filter-technology');
    var categorySelect = document.getElementById('filter-category');
    var resultsEl = document.getElementById('browse-results');
    var countEl = document.getElementById('result-count');
    var resetBtn = document.getElementById('search-reset');
    if (!resultsEl) return;

    var sortState = null;

    function hasActiveFilters() {
      var query = searchInput ? searchInput.value.trim() : '';
      var collection = collectionSelect && collectionSelect.value;
      var tech = techInput ? techInput.value.trim() : '';
      var category = categorySelect && categorySelect.value;
      return !!(query || collection || tech || category);
    }

    function updateResetButton() {
      if (resetBtn) {
        var active = hasActiveFilters();
        resetBtn.disabled = !active;
        resetBtn.setAttribute('aria-disabled', active ? 'false' : 'true');
      }
    }

    function clearFilters() {
      if (searchInput) searchInput.value = '';
      if (collectionSelect) collectionSelect.value = '';
      if (techInput) techInput.value = '';
      if (categorySelect) categorySelect.value = '';
      runSearch();
    }

    function runSearch() {
      var query = searchInput ? searchInput.value.trim() : '';
      var collection = collectionSelect && collectionSelect.value ? [collectionSelect.value] : [];
      var techFilter = techInput ? techInput.value.trim() : '';
      var categoryFilter = categorySelect && categorySelect.value ? [categorySelect.value] : [];
      var filters = { collection: collection };
      if (techFilter) filters.technology = [techFilter];
      if (categoryFilter.length) filters.categories = categoryFilter;

      updateResetButton();

      window.VWAD.searchApps(query, filters).then(function (result) {
        var apps = result.apps;
        var total = result.total;
        var sorted = sortState ? sortApps(apps, sortState.column, sortState.dir) : apps.slice();
        if (countEl) {
          countEl.textContent = 'Showing ' + apps.length + ' of ' + total + ' application' + (total === 1 ? '' : 's');
        }
        resultsEl.innerHTML = renderTable(sorted, sortState, { query: query });
        resultsEl.querySelectorAll('.apps-table th.sortable button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var th = btn.closest('th');
            var col = th && th.getAttribute('data-sort');
            if (!col) return;
            if (sortState && sortState.column === col) {
              if (sortState.dir === 'asc') {
                sortState.dir = 'desc';
              } else {
                sortState = null;
              }
            } else {
              sortState = { column: col, dir: 'asc' };
            }
            runSearch();
          });
        });
        var clearBtn = resultsEl.querySelector('.sort-clear');
        if (clearBtn) clearBtn.addEventListener('click', function () { sortState = null; runSearch(); });
        var scrollOuter = resultsEl.querySelector('.table-scroll-outer');
        if (scrollOuter) {
          bindTableScrollFade(scrollOuter);
          updateTableScrollFade(scrollOuter);
          requestAnimationFrame(function () {
            updateTableScrollFade(scrollOuter);
          });
        }
        resultsEl.querySelectorAll('button.pill-filter').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var type = btn.getAttribute('data-filter-type');
            var value = btn.getAttribute('data-filter-value');
            if (type === 'collection' && collectionSelect) {
              collectionSelect.value = value || '';
              if (techInput) techInput.value = '';
              if (categorySelect) categorySelect.value = '';
            } else if (type === 'technology' && techInput) {
              techInput.value = value || '';
              if (collectionSelect) collectionSelect.value = '';
              if (categorySelect) categorySelect.value = '';
            } else if (type === 'category' && categorySelect) {
              categorySelect.value = value || '';
              if (collectionSelect) collectionSelect.value = '';
              if (techInput) techInput.value = '';
            }
            runSearch();
          });
        });
      });
    }

    function updateTableScrollFade(outer) {
      if (!outer) return;
      var wrap = outer.querySelector('.table-wrap');
      if (!wrap) return;
      var scrollable = wrap.scrollWidth > wrap.clientWidth;
      var atStart = wrap.scrollLeft <= 2;
      var atEnd = wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 2;
      var introDismissed = outer.getAttribute('data-intro-right-dismissed') === 'true';
      outer.classList.toggle('scrollable', scrollable);
      outer.classList.toggle('show-left', scrollable && !atStart);
      outer.classList.toggle('show-right', scrollable && !atEnd);
      outer.classList.toggle('intro-right-hint', scrollable && atStart && !introDismissed);
    }

    function dismissIntroRightHint(outer) {
      if (!outer || outer.getAttribute('data-intro-right-dismissed') === 'true') return;
      outer.setAttribute('data-intro-right-dismissed', 'true');
      outer.classList.remove('intro-right-hint');
      outer.classList.add('intro-right-hint-shrinking');
      window.setTimeout(function () {
        outer.classList.remove('intro-right-hint-shrinking');
      }, 260);
    }

    function bindTableScrollFade(outer) {
      if (!outer) return;
      var wrap = outer.querySelector('.table-wrap');
      if (!wrap) return;
      outer.setAttribute('data-intro-right-dismissed', 'false');
      wrap.addEventListener('scroll', function () {
        if (wrap.scrollLeft > 2) dismissIntroRightHint(outer);
        updateTableScrollFade(outer);
      });
      window.addEventListener('resize', function () { updateTableScrollFade(outer); });
      // Shift + wheel: horizontal scroll (common in spreadsheets, IDEs, design tools)
      wrap.addEventListener('wheel', function (e) {
        if (!e.shiftKey || wrap.scrollWidth <= wrap.clientWidth) return;
        wrap.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });
      // Keyboard: Arrow Left/Right when table area has focus (e.g. after Tab or click)
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('title', 'Shift+scroll or arrow keys to scroll horizontally');
      wrap.addEventListener('keydown', function (e) {
        if (wrap.scrollWidth <= wrap.clientWidth) return;
        var step = 40;
        if (e.key === 'ArrowLeft') {
          wrap.scrollLeft -= step;
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          dismissIntroRightHint(outer);
          wrap.scrollLeft += step;
          e.preventDefault();
        }
      });
    }

    if (searchInput) searchInput.addEventListener('input', runSearch);
    if (searchInput) searchInput.addEventListener('change', runSearch);
    if (collectionSelect) collectionSelect.addEventListener('change', runSearch);
    if (techInput) techInput.addEventListener('input', runSearch);
    if (techInput) techInput.addEventListener('change', runSearch);
    if (categorySelect) categorySelect.addEventListener('change', runSearch);
    if (resetBtn) resetBtn.addEventListener('click', clearFilters);

    runSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
