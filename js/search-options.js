/**
 * Shared search option data and value helpers for the browse page.
 */
(function () {
  'use strict';

  var Browse = window.VWADBrowse = window.VWADBrowse || {};
  var COLLECTION_OPTIONS = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'container', label: 'Container' },
    { value: 'platform', label: 'Platform' }
  ];
  var CATEGORY_OPTIONS = [
    { value: 'ctf', label: 'CTF' },
    { value: 'code-review', label: 'Code review' },
    { value: 'single-player', label: 'Single-player' },
    { value: 'multi-player', label: 'Multi-player' },
    { value: 'guided-lessons', label: 'Guided lessons' },
    { value: 'free-form', label: 'Free-form' },
    { value: 'scanner-test', label: 'Scanner test' }
  ];
  var COLLECTION_LABELS = buildOptionLabelMap(COLLECTION_OPTIONS);
  var CATEGORY_LABELS = buildOptionLabelMap(CATEGORY_OPTIONS);
  var STAR_LABELS = {
    none: 'None',
    '1': '>1',
    '100': '>100',
    '500': '>500',
    '1000': '>1000',
    '10000': '>10000'
  };

  function buildOptionLabelMap(options) {
    var labels = {};
    (options || []).forEach(function (option) {
      if (!option || !option.value) return;
      labels[option.value] = option.label || option.value;
    });
    return labels;
  }

  function getOptionValues(options) {
    return (options || []).map(function (option) {
      return option.value;
    });
  }

  function escapeHtml(value) {
    if (value == null) return '';
    var div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  function capitalizeWord(value) {
    if (value == null || value === '') return '';
    value = String(value);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getCollectionLabel(value) {
    return COLLECTION_LABELS[value] || capitalizeWord(value);
  }

  function getCategoryLabel(value) {
    return CATEGORY_LABELS[value] || String(value || '');
  }

  function getReferenceLabel(value) {
    return capitalizeWord(value);
  }

  function getStarsLabel(value) {
    if (value == null || value === '') return 'Any';
    return STAR_LABELS[value] || ('>' + value);
  }

  function renderSelectOptions(select, emptyLabel, options) {
    if (!select) return;
    var currentValue = select.value;
    select.innerHTML = '<option value="">' + escapeHtml(emptyLabel) + '</option>' + (options || []).map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
    }).join('');
    select.value = currentValue;
    if (select.value !== currentValue) select.value = '';
  }

  function populateBasicOptions(basicElements) {
    if (!basicElements) return;
    renderSelectOptions(basicElements.collection, 'All collections', COLLECTION_OPTIONS);
    renderSelectOptions(basicElements.category, 'All categories', CATEGORY_OPTIONS);
  }

  function normalizeValue(value) {
    return String(value || '').toLowerCase();
  }

  function arraysContainValue(values, value) {
    var normalizedValue = normalizeValue(value);
    return (values || []).some(function (entry) {
      return normalizeValue(entry) === normalizedValue;
    });
  }

  function addUniqueValue(values, value) {
    if (value == null || value === '') return (values || []).slice();
    var next = (values || []).slice();
    if (!arraysContainValue(next, value)) next.push(value);
    return next;
  }

  function removeValue(values, value) {
    var normalizedValue = normalizeValue(value);
    return (values || []).filter(function (entry) {
      return normalizeValue(entry) !== normalizedValue;
    });
  }

  Browse.COLLECTION_OPTIONS = COLLECTION_OPTIONS;
  Browse.CATEGORY_OPTIONS = CATEGORY_OPTIONS;
  Browse.getOptionValues = getOptionValues;
  Browse.escapeHtml = escapeHtml;
  Browse.getCollectionLabel = getCollectionLabel;
  Browse.getCategoryLabel = getCategoryLabel;
  Browse.getReferenceLabel = getReferenceLabel;
  Browse.getStarsLabel = getStarsLabel;
  Browse.populateBasicOptions = populateBasicOptions;
  Browse.arraysContainValue = arraysContainValue;
  Browse.addUniqueValue = addUniqueValue;
  Browse.removeValue = removeValue;
})();
