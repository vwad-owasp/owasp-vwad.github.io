/**
 * Browse page bootstrap: Basic search controls, mode switching, and search orchestration.
 */
(function () {
  'use strict';

  var Browse = window.VWADBrowse || {};

  function createDefaultBasicState() {
    return {
      query: '',
      collection: '',
      technology: '',
      category: ''
    };
  }

  function createDefaultState() {
    return {
      activeMode: 'basic',
      basic: createDefaultBasicState(),
      advanced: Browse.createDefaultAdvancedState()
    };
  }

  function initSearch() {
    var resultsEl = document.getElementById('browse-results');
    var countEl = document.getElementById('result-count');
    var resetBtn = document.getElementById('search-reset');
    var searchControls = document.querySelector('.search-controls');
    if (!resultsEl || !searchControls) return;

    var elements = {
      tabs: {
        basic: document.getElementById('search-type-basic'),
        advanced: document.getElementById('search-type-advanced')
      },
      panels: {
        basic: document.getElementById('search-panel-basic'),
        advanced: document.getElementById('search-panel-advanced')
      },
      basic: {
        query: document.getElementById('search-input'),
        collection: document.getElementById('filter-collection'),
        technology: document.getElementById('filter-technology'),
        category: document.getElementById('filter-category')
      },
      advanced: {
        query: document.getElementById('advanced-search-input'),
        stars: document.getElementById('advanced-stars'),
        yearFrom: document.getElementById('advanced-year-from'),
        yearTo: document.getElementById('advanced-year-to'),
        starsPills: document.getElementById('advanced-stars-pills'),
        yearPills: document.getElementById('advanced-year-pills')
      }
    };
    var state = createDefaultState();
    var sortState = null;
    var requestId = 0;
    var activeScrollOuter = null;
    var advancedController = Browse.createAdvancedController({
      searchControls: searchControls,
      elements: elements.advanced,
      getState: function () {
        return state.advanced;
      },
      isActive: function () {
        return state.activeMode === 'advanced';
      },
      requestSearch: runSearch
    });

    if (!advancedController) return;

    function getActiveState() {
      return state[state.activeMode];
    }

    function hasActiveFilters(mode) {
      var viewState = state[mode];
      if (mode === 'basic') {
        return !!((viewState.query || '').trim() || viewState.collection || (viewState.technology || '').trim() || viewState.category);
      }
      return advancedController.hasActiveFilters();
    }

    function updateResetButton() {
      if (!resetBtn) return;
      var active = hasActiveFilters(state.activeMode);
      resetBtn.disabled = !active;
      resetBtn.setAttribute('aria-disabled', active ? 'false' : 'true');
      resetBtn.setAttribute('aria-label', 'Clear all ' + state.activeMode + ' search filters');
    }

    function syncModeUi() {
      ['basic', 'advanced'].forEach(function (mode) {
        var isActive = state.activeMode === mode;
        var tab = elements.tabs[mode];
        var panel = elements.panels[mode];
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });
      updateResetButton();
    }

    function syncBasicControls() {
      elements.basic.query.value = state.basic.query;
      elements.basic.collection.value = state.basic.collection;
      elements.basic.technology.value = state.basic.technology;
      elements.basic.category.value = state.basic.category;
    }

    function setActiveMode(mode, focusTab) {
      if (mode !== 'advanced') mode = 'basic';
      if (state.activeMode === mode) {
        if (focusTab) elements.tabs[mode].focus();
        return;
      }
      advancedController.closeAllPanels(false);
      state.activeMode = mode;
      syncModeUi();
      if (focusTab) elements.tabs[mode].focus();
      runSearch();
    }

    function clearActiveModeFilters() {
      advancedController.closeAllPanels(false);
      if (state.activeMode === 'basic') {
        state.basic = createDefaultBasicState();
        syncBasicControls();
      } else {
        state.advanced = Browse.createDefaultAdvancedState();
        advancedController.syncControls();
      }
      runSearch();
    }

    function buildSearchPayload() {
      var activeState = getActiveState();
      var query = (activeState.query || '').trim();
      var filters = {};

      if (state.activeMode === 'basic') {
        filters.collection = activeState.collection ? [activeState.collection] : [];
        var techFilter = (activeState.technology || '').trim();
        if (techFilter) filters.technology = [techFilter];
        if (activeState.category) filters.categories = [activeState.category];
        return { query: query, filters: filters };
      }

      return {
        query: query,
        filters: advancedController.buildFilters()
      };
    }

    function applyBasicTableFilter(type, value) {
      if (type === 'collection') {
        state.basic.collection = value || '';
        state.basic.technology = '';
        state.basic.category = '';
        return true;
      }
      if (type === 'technology') {
        state.basic.technology = value || '';
        state.basic.collection = '';
        state.basic.category = '';
        return true;
      }
      if (type === 'category') {
        state.basic.category = value || '';
        state.basic.collection = '';
        state.basic.technology = '';
        return true;
      }
      return false;
    }

    function bindTableInteractions() {
      resultsEl.querySelectorAll('.apps-table th.sortable button').forEach(function (button) {
        button.addEventListener('click', function () {
          var th = button.closest('th');
          var column = th && th.getAttribute('data-sort');
          if (!column) return;
          if (sortState && sortState.column === column) {
            if (sortState.dir === 'asc') {
              sortState.dir = 'desc';
            } else {
              sortState = null;
            }
          } else {
            sortState = { column: column, dir: 'asc' };
          }
          runSearch();
        });
      });

      var clearBtn = resultsEl.querySelector('.sort-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          sortState = null;
          runSearch();
        });
      }

      var scrollOuter = resultsEl.querySelector('.table-scroll-outer');
      activeScrollOuter = scrollOuter || null;
      if (scrollOuter) {
        Browse.updateTableScrollMetrics(scrollOuter);
        var tableScrollState = Browse.captureTableScrollState(resultsEl);
        Browse.bindTableScrollFade(scrollOuter);
        Browse.restoreTableScrollState(scrollOuter, tableScrollState);
        if (!tableScrollState) {
          Browse.updateTableScrollMetrics(scrollOuter);
          Browse.updateTableScrollFade(scrollOuter);
          requestAnimationFrame(function () {
            Browse.updateTableScrollMetrics(scrollOuter);
            Browse.updateTableScrollFade(scrollOuter);
          });
        }
      }

      resultsEl.querySelectorAll('button.pill-filter').forEach(function (button) {
        button.addEventListener('click', function () {
          var type = button.getAttribute('data-filter-type');
          var value = button.getAttribute('data-filter-value');
          var applied = state.activeMode === 'basic'
            ? applyBasicTableFilter(type, value)
            : advancedController.applyTableFilter(type, value);
          if (!applied) return;
          if (state.activeMode === 'basic') {
            syncBasicControls();
          } else {
            advancedController.syncControls();
          }
          runSearch();
        });
      });
    }

    function runSearch() {
      var payload = buildSearchPayload();
      var currentRequestId = ++requestId;
      var tableScrollState = Browse.captureTableScrollState(resultsEl);

      updateResetButton();

      window.VWAD.searchApps(payload.query, payload.filters).then(function (result) {
        if (currentRequestId !== requestId) return;
        var apps = result.apps;
        var total = result.total;
        var sorted = sortState ? Browse.sortApps(apps, sortState.column, sortState.dir) : apps.slice();
        if (countEl) {
          countEl.textContent = 'Showing ' + apps.length + ' of ' + total + ' application' + (total === 1 ? '' : 's');
        }
        resultsEl.innerHTML = Browse.renderTable(sorted, sortState, { query: payload.query });
        if (tableScrollState) {
          var outer = resultsEl.querySelector('.table-scroll-outer');
          if (outer) Browse.restoreTableScrollState(outer, tableScrollState);
        }
        bindTableInteractions();
      }).catch(function () {
        if (currentRequestId !== requestId) return;
        activeScrollOuter = null;
        if (countEl) countEl.textContent = 'Could not load applications.';
        resultsEl.innerHTML = '<p class="muted">Failed to load directory.</p>';
      });
    }

    elements.tabs.basic.addEventListener('click', function () {
      setActiveMode('basic', false);
    });
    elements.tabs.advanced.addEventListener('click', function () {
      setActiveMode('advanced', false);
    });

    [elements.tabs.basic, elements.tabs.advanced].forEach(function (tab) {
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        if (event.key === 'Home') {
          setActiveMode('basic', true);
          return;
        }
        if (event.key === 'End') {
          setActiveMode('advanced', true);
          return;
        }
        setActiveMode(state.activeMode === 'basic' ? 'advanced' : 'basic', true);
      });
    });

    elements.basic.query.addEventListener('input', function () {
      state.basic.query = elements.basic.query.value;
      if (state.activeMode === 'basic') runSearch();
    });
    elements.basic.query.addEventListener('change', function () {
      state.basic.query = elements.basic.query.value;
      if (state.activeMode === 'basic') runSearch();
    });
    elements.basic.collection.addEventListener('change', function () {
      state.basic.collection = elements.basic.collection.value;
      if (state.activeMode === 'basic') runSearch();
    });
    elements.basic.technology.addEventListener('input', function () {
      state.basic.technology = elements.basic.technology.value;
      if (state.activeMode === 'basic') runSearch();
    });
    elements.basic.technology.addEventListener('change', function () {
      state.basic.technology = elements.basic.technology.value;
      if (state.activeMode === 'basic') runSearch();
    });
    elements.basic.category.addEventListener('change', function () {
      state.basic.category = elements.basic.category.value;
      if (state.activeMode === 'basic') runSearch();
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', clearActiveModeFilters);
    }

    window.addEventListener('resize', function () {
      if (activeScrollOuter) {
        Browse.updateTableScrollMetrics(activeScrollOuter);
        Browse.updateTableScrollFade(activeScrollOuter);
      }
    });

    Browse.populateBasicOptions(elements.basic);
    syncBasicControls();
    advancedController.syncControls();
    syncModeUi();

    window.VWAD.getCollection().then(function (list) {
      advancedController.populateDataOptions(list || []);
    });

    runSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
