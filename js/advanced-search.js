/**
 * Advanced search controller for the browse page.
 */
(function () {
  'use strict';

  var Browse = window.VWADBrowse = window.VWADBrowse || {};

  function createDefaultAdvancedState() {
    return {
      query: '',
      collection: [],
      collectionMode: 'or',
      technology: [],
      technologyMode: 'or',
      categories: [],
      categoriesMode: 'or',
      references: [],
      referencesMode: 'or',
      stars: '',
      yearFrom: '',
      yearTo: ''
    };
  }

  function renderPillButtons(container, items) {
    var escapeHtml = Browse.escapeHtml;
    if (!container) return;
    if (!items || !items.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = items.map(function (item) {
      var classes = 'pill search-filter-pill';
      if (item.pillClass) classes += ' ' + item.pillClass;
      return '<button type="button" class="' + escapeHtml(classes) + '" data-pill-group="' + escapeHtml(item.group) + '" data-pill-value="' + escapeHtml(item.value) + '" aria-label="' + escapeHtml(item.ariaLabel) + '">' + escapeHtml(item.label) + ' <span class="search-filter-pill-remove" aria-hidden="true">&times;</span></button>';
    }).join('');
  }

  function createAdvancedController(options) {
    options = options || {};

    var searchControls = options.searchControls;
    var elements = options.elements || {};
    var getState = options.getState;
    var isActive = options.isActive || function () { return true; };
    var requestSearch = options.requestSearch || function () {};
    var escapeHtml = Browse.escapeHtml;
    var optionValues = {
      collection: Browse.getOptionValues(Browse.COLLECTION_OPTIONS),
      technology: [],
      categories: Browse.getOptionValues(Browse.CATEGORY_OPTIONS),
      references: [],
      years: []
    };
    var openPanelGroup = null;
    var multiSelects = {
      collection: {
        valueKey: 'collection',
        modeKey: 'collectionMode',
        defaultLabel: 'Select collections',
        labelForValue: Browse.getCollectionLabel,
        trigger: document.getElementById('advanced-collection-trigger'),
        panel: document.getElementById('advanced-collection-panel'),
        options: document.getElementById('advanced-collection-options'),
        pills: document.getElementById('advanced-collection-pills'),
        done: searchControls.querySelector('[data-close-panel="collection"]'),
        root: searchControls.querySelector('[data-multi-select="collection"]'),
        logicButtons: searchControls.querySelectorAll('[data-logic-group="collection"]')
      },
      technology: {
        valueKey: 'technology',
        modeKey: 'technologyMode',
        defaultLabel: 'Select technologies',
        labelForValue: function (value) { return value; },
        trigger: document.getElementById('advanced-tech-trigger'),
        panel: document.getElementById('advanced-tech-panel'),
        options: document.getElementById('advanced-tech-options'),
        pills: document.getElementById('advanced-tech-pills'),
        done: searchControls.querySelector('[data-close-panel="technology"]'),
        root: searchControls.querySelector('[data-multi-select="technology"]'),
        logicButtons: searchControls.querySelectorAll('[data-logic-group="technology"]')
      },
      categories: {
        valueKey: 'categories',
        modeKey: 'categoriesMode',
        defaultLabel: 'Select categories',
        labelForValue: Browse.getCategoryLabel,
        trigger: document.getElementById('advanced-category-trigger'),
        panel: document.getElementById('advanced-category-panel'),
        options: document.getElementById('advanced-category-options'),
        pills: document.getElementById('advanced-category-pills'),
        done: searchControls.querySelector('[data-close-panel="categories"]'),
        root: searchControls.querySelector('[data-multi-select="categories"]'),
        logicButtons: searchControls.querySelectorAll('[data-logic-group="categories"]')
      },
      references: {
        valueKey: 'references',
        modeKey: 'referencesMode',
        defaultLabel: 'Select reference types',
        labelForValue: Browse.getReferenceLabel,
        trigger: document.getElementById('advanced-reference-trigger'),
        panel: document.getElementById('advanced-reference-panel'),
        options: document.getElementById('advanced-reference-options'),
        pills: document.getElementById('advanced-reference-pills'),
        done: searchControls.querySelector('[data-close-panel="references"]'),
        root: searchControls.querySelector('[data-multi-select="references"]'),
        logicButtons: searchControls.querySelectorAll('[data-logic-group="references"]')
      }
    };

    function currentState() {
      return getState();
    }

    function closePanel(group, focusTrigger) {
      var config = multiSelects[group];
      if (!config) return;
      config.panel.hidden = true;
      config.trigger.setAttribute('aria-expanded', 'false');
      config.root.classList.remove('is-open');
      if (focusTrigger) config.trigger.focus();
      if (openPanelGroup === group) openPanelGroup = null;
    }

    function closeAllPanels(focusTrigger) {
      Object.keys(multiSelects).forEach(function (group) {
        closePanel(group, focusTrigger && openPanelGroup === group);
      });
    }

    function openPanel(group) {
      var config = multiSelects[group];
      if (!config) return;
      if (openPanelGroup && openPanelGroup !== group) closePanel(openPanelGroup, false);
      if (openPanelGroup === group && !config.panel.hidden) {
        closePanel(group, true);
        return;
      }
      config.panel.hidden = false;
      config.trigger.setAttribute('aria-expanded', 'true');
      config.root.classList.add('is-open');
      openPanelGroup = group;
      requestAnimationFrame(function () {
        var focusTarget = config.panel.querySelector('input:checked') || config.panel.querySelector('input') || config.done;
        if (focusTarget) focusTarget.focus();
      });
    }

    function renderMultiSelect(group) {
      var config = multiSelects[group];
      var state = currentState();
      var values = state[config.valueKey];
      var mode = state[config.modeKey];
      var selectedInputs = config.options.querySelectorAll('input[type="checkbox"]');
      Array.prototype.forEach.call(selectedInputs, function (input) {
        input.checked = Browse.arraysContainValue(values, input.value);
      });

      Array.prototype.forEach.call(config.logicButtons, function (button) {
        var isCurrent = button.getAttribute('data-logic-value') === mode;
        button.classList.toggle('is-active', isCurrent);
        button.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      });

      if (!values.length) {
        config.trigger.textContent = config.defaultLabel;
      } else if (values.length === 1) {
        config.trigger.textContent = config.labelForValue(values[0]);
      } else {
        config.trigger.textContent = values.length + ' selected';
      }

      renderPillButtons(config.pills, values.map(function (value) {
        return {
          group: config.valueKey,
          value: value,
          label: config.labelForValue(value),
          ariaLabel: 'Remove ' + config.labelForValue(value) + ' from ' + group + ' filters',
          pillClass: group === 'categories' ? 'pill-category' : group === 'collection' ? 'pill-collection' : ''
        };
      }));
    }

    function renderStarsPills() {
      var state = currentState();
      var pills = [];
      if (state.stars) {
        pills.push({
          group: 'stars',
          value: state.stars,
          label: Browse.getStarsLabel(state.stars),
          ariaLabel: 'Remove GitHub stars filter: ' + Browse.getStarsLabel(state.stars)
        });
      }
      renderPillButtons(elements.starsPills, pills);
    }

    function renderYearPills() {
      var state = currentState();
      var pills = [];
      if (state.yearFrom) {
        pills.push({
          group: 'yearFrom',
          value: state.yearFrom,
          label: 'From: ' + state.yearFrom,
          ariaLabel: 'Remove year from filter: ' + state.yearFrom
        });
      }
      if (state.yearTo) {
        pills.push({
          group: 'yearTo',
          value: state.yearTo,
          label: 'To: ' + state.yearTo,
          ariaLabel: 'Remove year to filter: ' + state.yearTo
        });
      }
      renderPillButtons(elements.yearPills, pills);
    }

    function normalizeYearRange(changedField) {
      var state = currentState();
      var yearFrom = state.yearFrom ? Number(state.yearFrom) : null;
      var yearTo = state.yearTo ? Number(state.yearTo) : null;
      if (yearFrom == null || yearTo == null) return;
      if (isNaN(yearFrom) || isNaN(yearTo) || yearFrom <= yearTo) return;
      if (changedField === 'yearFrom') {
        state.yearTo = state.yearFrom;
      } else if (changedField === 'yearTo') {
        state.yearFrom = state.yearTo;
      }
    }

    function syncControls() {
      var state = currentState();
      elements.query.value = state.query;
      elements.stars.value = state.stars;
      elements.yearFrom.value = state.yearFrom;
      elements.yearTo.value = state.yearTo;
      renderStarsPills();
      renderYearPills();
      Object.keys(multiSelects).forEach(function (group) {
        renderMultiSelect(group);
      });
    }

    function hasActiveFilters() {
      var state = currentState();
      return !!(
        (state.query || '').trim() ||
        state.collection.length ||
        state.technology.length ||
        state.categories.length ||
        state.references.length ||
        state.stars ||
        state.yearFrom ||
        state.yearTo
      );
    }

    function buildFilters() {
      var state = currentState();
      var filters = {};

      if (state.collection.length) {
        filters.collection = state.collection.slice();
        filters.collectionMode = state.collectionMode;
      }
      if (state.technology.length) {
        filters.technology = state.technology.slice();
        filters.technologyMode = state.technologyMode;
      }
      if (state.categories.length) {
        filters.categories = state.categories.slice();
        filters.categoriesMode = state.categoriesMode;
      }
      if (state.references.length) {
        filters.references = state.references.slice();
        filters.referencesMode = state.referencesMode;
      }
      if (state.stars) filters.stars = state.stars;
      if (state.yearFrom) filters.yearFrom = state.yearFrom;
      if (state.yearTo) filters.yearTo = state.yearTo;
      return filters;
    }

    function applyTableFilter(type, value) {
      var state = currentState();
      if (type === 'collection') {
        state.collection = Browse.addUniqueValue(state.collection, value);
        return true;
      }
      if (type === 'technology') {
        state.technology = Browse.addUniqueValue(state.technology, value);
        return true;
      }
      if (type === 'category') {
        state.categories = Browse.addUniqueValue(state.categories, value);
        return true;
      }
      return false;
    }

    function renderMultiSelectOptions(group, values) {
      var config = multiSelects[group];
      if (!config || !config.options) return;
      config.options.innerHTML = values.map(function (value) {
        var label = config.labelForValue(value);
        return '<label class="advanced-option"><input type="checkbox" data-multi-option="' + escapeHtml(group) + '" value="' + escapeHtml(value) + '"><span>' + escapeHtml(label) + '</span></label>';
      }).join('');
      renderMultiSelect(group);
    }

    function populateYearOptions(values) {
      [elements.yearFrom, elements.yearTo].forEach(function (select) {
        var currentValue = select.value;
        select.innerHTML = '<option value="">Any</option>' + values.map(function (year) {
          return '<option value="' + escapeHtml(year) + '">' + escapeHtml(year) + '</option>';
        }).join('');
        select.value = currentValue;
      });
    }

    function populateDataOptions(list) {
      var techSet = {};
      var refSet = {};
      var yearSet = {};
      list.forEach(function (app) {
        (app.technology || []).forEach(function (tech) {
          if (tech) techSet[tech] = true;
        });
        (app.references || []).forEach(function (ref) {
          if (ref && ref.name) refSet[ref.name] = true;
        });
        if (app.last_contributed) {
          var dateValue = new Date(app.last_contributed);
          if (!isNaN(dateValue.getTime())) yearSet[String(dateValue.getUTCFullYear())] = true;
        }
      });

      optionValues.technology = Object.keys(techSet).sort(function (a, b) {
        return a.localeCompare(b);
      });
      optionValues.collection = Browse.getOptionValues(Browse.COLLECTION_OPTIONS);
      optionValues.references = Object.keys(refSet).sort(function (a, b) {
        return a.localeCompare(b);
      });
      optionValues.categories = Browse.getOptionValues(Browse.CATEGORY_OPTIONS);
      optionValues.years = Object.keys(yearSet).sort(function (a, b) {
        return Number(b) - Number(a);
      });

      renderMultiSelectOptions('collection', optionValues.collection);
      renderMultiSelectOptions('technology', optionValues.technology);
      renderMultiSelectOptions('categories', optionValues.categories);
      renderMultiSelectOptions('references', optionValues.references);
      populateYearOptions(optionValues.years);
      syncControls();
    }

    elements.query.addEventListener('input', function () {
      currentState().query = elements.query.value;
      if (isActive()) requestSearch();
    });
    elements.query.addEventListener('change', function () {
      currentState().query = elements.query.value;
      if (isActive()) requestSearch();
    });
    elements.stars.addEventListener('change', function () {
      currentState().stars = elements.stars.value;
      renderStarsPills();
      if (isActive()) requestSearch();
    });
    elements.yearFrom.addEventListener('change', function () {
      var state = currentState();
      state.yearFrom = elements.yearFrom.value;
      normalizeYearRange('yearFrom');
      elements.yearTo.value = state.yearTo;
      renderYearPills();
      if (isActive()) requestSearch();
    });
    elements.yearTo.addEventListener('change', function () {
      var state = currentState();
      state.yearTo = elements.yearTo.value;
      normalizeYearRange('yearTo');
      elements.yearFrom.value = state.yearFrom;
      renderYearPills();
      if (isActive()) requestSearch();
    });

    Object.keys(multiSelects).forEach(function (group) {
      var config = multiSelects[group];

      config.trigger.addEventListener('click', function () {
        openPanel(group);
      });

      config.options.addEventListener('change', function (event) {
        var target = event.target || event.srcElement;
        var state = currentState();
        if (!target || target.tagName !== 'INPUT' || target.type !== 'checkbox') return;
        var nextValues = Array.prototype.slice.call(config.options.querySelectorAll('input[type="checkbox"]:checked')).map(function (input) {
          return input.value;
        });
        state[config.valueKey] = nextValues;
        if (!nextValues.length) state[config.modeKey] = 'or';
        renderMultiSelect(group);
        if (isActive()) requestSearch();
      });

      Array.prototype.forEach.call(config.logicButtons, function (button) {
        button.addEventListener('click', function () {
          var state = currentState();
          state[config.modeKey] = button.getAttribute('data-logic-value') || 'or';
          renderMultiSelect(group);
          if (isActive()) requestSearch();
        });
      });

      if (config.done) {
        config.done.addEventListener('click', function () {
          closePanel(group, true);
        });
      }
    });

    searchControls.addEventListener('click', function (event) {
      var pillButton = event.target.closest('.search-filter-pill');
      var state = currentState();
      if (!pillButton) return;
      var group = pillButton.getAttribute('data-pill-group');
      var value = pillButton.getAttribute('data-pill-value');
      if (group === 'collection') {
        state.collection = Browse.removeValue(state.collection, value);
        if (!state.collection.length) state.collectionMode = 'or';
      } else if (group === 'technology') {
        state.technology = Browse.removeValue(state.technology, value);
        if (!state.technology.length) state.technologyMode = 'or';
      } else if (group === 'categories') {
        state.categories = Browse.removeValue(state.categories, value);
        if (!state.categories.length) state.categoriesMode = 'or';
      } else if (group === 'references') {
        state.references = Browse.removeValue(state.references, value);
        if (!state.references.length) state.referencesMode = 'or';
      } else if (group === 'stars') {
        state.stars = '';
      } else if (group === 'yearFrom') {
        state.yearFrom = '';
      } else if (group === 'yearTo') {
        state.yearTo = '';
      }
      syncControls();
      if (isActive()) requestSearch();
    });

    document.addEventListener('click', function (event) {
      if (!openPanelGroup) return;
      var config = multiSelects[openPanelGroup];
      if (config && config.root && !config.root.contains(event.target)) {
        closePanel(openPanelGroup, false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && openPanelGroup) {
        closePanel(openPanelGroup, true);
      }
    });

    renderMultiSelectOptions('collection', optionValues.collection);
    renderMultiSelectOptions('categories', optionValues.categories);

    return {
      closeAllPanels: closeAllPanels,
      hasActiveFilters: hasActiveFilters,
      syncControls: syncControls,
      buildFilters: buildFilters,
      applyTableFilter: applyTableFilter,
      populateDataOptions: populateDataOptions
    };
  }

  Browse.createDefaultAdvancedState = createDefaultAdvancedState;
  Browse.createAdvancedController = createAdvancedController;
})();
