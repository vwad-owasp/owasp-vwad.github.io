/**
 * Table rendering, sorting, and scroll behavior for the browse page.
 */
(function () {
  'use strict';

  var Browse = window.VWADBrowse = window.VWADBrowse || {};
  var SORT_LABELS = {
    name: 'Name',
    stars: 'Stars',
    updated: 'Updated'
  };

  function getAppUrl(app) {
    return 'app/#' + (app._slug || '');
  }

  function sortApps(apps, sortBy, sortDir) {
    if (!sortBy || !sortDir || !apps.length) return apps.slice();
    var mult = sortDir === 'desc' ? -1 : 1;
    return apps.slice().sort(function (a, b) {
      var va;
      var vb;
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

  function getSortSummary(sortState) {
    if (!sortState || !sortState.column || !sortState.dir) return '';
    var label = SORT_LABELS[sortState.column];
    if (!label) return '';
    var direction = sortState.dir === 'desc' ? 'descending' : 'ascending';
    return 'Sorted by ' + label + ', ' + direction;
  }

  function renderTable(apps, sortState, options) {
    var escapeHtml = Browse.escapeHtml;
    if (!apps.length) {
      return '<p class="muted">No applications match.</p>';
    }
    options = options || {};
    var query = (options.query || '').toLowerCase().trim();
    var sortBy = sortState && sortState.column;
    var sortDir = sortState && sortState.dir;
    var sortSummary = getSortSummary(sortState);
    var th = function (key, label) {
      var isSortable = !!SORT_LABELS[key];
      if (!isSortable) return '<th>' + escapeHtml(label) + '</th>';
      var ariaSort = sortBy === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      var cls = 'sortable' + (sortBy === key ? ' sorted-' + sortDir : '');
      return '<th class="' + cls + '" scope="col" data-sort="' + escapeHtml(key) + '" aria-sort="' + ariaSort + '"><button type="button">' + escapeHtml(label) + '</button></th>';
    };
    var clearSortHtml = sortSummary
      ? '<caption class="table-toolbar"><div class="table-toolbar-row"><button type="button" class="sort-clear">Clear sort</button><span class="sort-status" role="status" aria-live="polite">' + escapeHtml(sortSummary) + '</span></div></caption>'
      : '';
    var html = '<div class="table-scroll-outer"><div class="table-scroll-shadow table-scroll-shadow-top" aria-hidden="true"></div><div class="table-wrap"><table class="apps-table">' + clearSortHtml + '<thead><tr>';
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
      html += '<td>' + (app.collection || []).map(function (collection) {
        var title = collTitles[collection];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        var label = Browse.getCollectionLabel(collection);
        return '<button type="button" class="pill pill-collection pill-filter" data-filter-type="collection" data-filter-value="' + escapeHtml(collection) + '" aria-label="Filter by collection: ' + escapeHtml(label) + '"' + titleAttr + '>' + escapeHtml(collection) + '</button>';
      }).join(' ') + '</td>';
      var tech = (app.technology || []).map(function (technology) {
        return '<button type="button" class="pill pill-technology pill-filter" data-filter-type="technology" data-filter-value="' + escapeHtml(technology) + '" aria-label="Filter by technology: ' + escapeHtml(technology) + '">' + escapeHtml(technology) + '</button>';
      }).join(' ');
      var categories = (app.categories || []).map(function (category) {
        var label = Browse.getCategoryLabel(category);
        var title = catTitles[category];
        var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
        return '<button type="button" class="pill pill-category pill-filter" data-filter-type="category" data-filter-value="' + escapeHtml(category) + '" aria-label="Filter by category: ' + escapeHtml(label) + '"' + titleAttr + '>' + escapeHtml(label) + '</button>';
      }).join(' ');
      html += '<td>' + tech + (tech && categories ? ' ' : '') + categories + '</td>';
      html += '<td>' + (app.stars != null ? escapeHtml(String(app.stars)) : '-') + '</td>';
      html += '<td>' + updatedCell + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div><div class="table-scroll-shadow table-scroll-shadow-bottom" aria-hidden="true"></div></div>';
    return html;
  }

  function captureTableScrollState(container) {
    if (!container) return null;
    var outer = container.querySelector('.table-scroll-outer');
    var wrap = outer && outer.querySelector('.table-wrap');
    if (!outer || !wrap) return null;
    return {
      left: wrap.scrollLeft,
      top: wrap.scrollTop,
      introDismissed: outer.getAttribute('data-intro-right-dismissed') === 'true'
    };
  }

  function restoreTableScrollState(outer, state) {
    if (!outer || !state) return;
    var wrap = outer.querySelector('.table-wrap');
    if (!wrap) return;

    function applyScrollState() {
      if (state.left > 0) wrap.scrollLeft = state.left;
      if (state.top > 0) wrap.scrollTop = state.top;
      if (state.introDismissed || state.left > 2) dismissIntroRightHint(outer);
      updateTableScrollMetrics(outer);
      updateTableScrollFade(outer);
    }

    applyScrollState();
    requestAnimationFrame(applyScrollState);
  }

  function updateTableScrollMetrics(outer) {
    if (!outer) return;
    var caption = outer.querySelector('.table-toolbar');
    var headerRow = outer.querySelector('.apps-table thead tr');
    outer.style.setProperty('--toolbar-h', caption ? caption.offsetHeight + 'px' : '0px');
    outer.style.setProperty('--thead-h', headerRow ? headerRow.getBoundingClientRect().height + 'px' : '0px');
  }

  function updateTableScrollFade(outer) {
    if (!outer) return;
    var wrap = outer.querySelector('.table-wrap');
    if (!wrap) return;
    var scrollableX = wrap.scrollWidth > wrap.clientWidth + 2;
    var scrollableY = wrap.scrollHeight > wrap.clientHeight + 2;
    var atStart = wrap.scrollLeft <= 2;
    var atEnd = wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 2;
    var atTop = wrap.scrollTop <= 2;
    var atBottom = wrap.scrollTop >= wrap.scrollHeight - wrap.clientHeight - 2;
    var introDismissed = outer.getAttribute('data-intro-right-dismissed') === 'true';
    outer.classList.toggle('scrollable', scrollableX);
    outer.classList.toggle('scrollable-y', scrollableY);
    outer.classList.toggle('show-left', scrollableX && !atStart);
    outer.classList.toggle('show-right', scrollableX && !atEnd);
    outer.classList.toggle('show-top', scrollableY && !atTop);
    outer.classList.toggle('show-bottom', scrollableY && !atBottom);
    outer.classList.toggle('intro-right-hint', scrollableX && atStart && !introDismissed);
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
    updateTableScrollMetrics(outer);
    wrap.addEventListener('scroll', function () {
      if (wrap.scrollLeft > 2) dismissIntroRightHint(outer);
      updateTableScrollFade(outer);
    });
    wrap.addEventListener('wheel', function (event) {
      if (!event.shiftKey || wrap.scrollWidth <= wrap.clientWidth) return;
      wrap.scrollLeft += event.deltaY;
      event.preventDefault();
    }, { passive: false });
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('title', 'Shift+scroll or arrow keys to scroll horizontally');
    wrap.addEventListener('keydown', function (event) {
      if (wrap.scrollWidth <= wrap.clientWidth) return;
      var step = 40;
      if (event.key === 'ArrowLeft') {
        wrap.scrollLeft -= step;
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        dismissIntroRightHint(outer);
        wrap.scrollLeft += step;
        event.preventDefault();
      }
    });
  }

  Browse.sortApps = sortApps;
  Browse.renderTable = renderTable;
  Browse.captureTableScrollState = captureTableScrollState;
  Browse.restoreTableScrollState = restoreTableScrollState;
  Browse.updateTableScrollMetrics = updateTableScrollMetrics;
  Browse.updateTableScrollFade = updateTableScrollFade;
  Browse.bindTableScrollFade = bindTableScrollFade;
})();
