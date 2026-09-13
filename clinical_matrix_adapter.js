/* Адаптер JSON-модели в формат планировщика. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClinicalMatrixAdapter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATEGORY_LABELS = {
    lab: 'Лабораторные методы',
    instrumental: 'Инструментальные методы',
    consultation: 'Консультации специалистов',
    exam: 'Осмотры (проводит врач)',
    calculation: 'Расчётные показатели'
  };
  var CATEGORY_ORDER = ['lab', 'instrumental', 'consultation', 'exam', 'calculation'];
  var MANDATORY = new Set([
    'mandatory_for_situation',
    'mandatory_for_stage',
    'mandatory_if_condition',
    'emergency'
  ]);

  function unique(values) {
    return Array.from(new Set(values || []));
  }

  function convertItem(model, resultItem, checked) {
    var examination = model.examinations.find(function (entry) {
      return entry.id === resultItem.examinationId;
    });
    if (!examination) throw new Error('Неизвестное обследование: ' + resultItem.examinationId);
    var category = examination.category;
    return {
      examinationId: resultItem.examinationId,
      name: examination.label,
      type: category,
      categoryLabel: CATEGORY_LABELS[category] || category,
      checked: checked,
      autoSelected: Boolean(resultItem.autoSelected),
      status: resultItem.status,
      reasons: unique(resultItem.reasons),
      ruleIds: unique(resultItem.ruleIds),
      sourceIds: unique(resultItem.sourceIds),
      availability: resultItem.availability,
      frequency: examination.frequency || 2
    };
  }

  function sortItems(a, b) {
    return CATEGORY_ORDER.indexOf(a.type) - CATEGORY_ORDER.indexOf(b.type) || (a.frequency || 2) - (b.frequency || 2) || a.name.localeCompare(b.name, 'ru');
  }

  function buildCopyText(items) {
    var grouped = {};
    items.forEach(function (item) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item.name);
    });
    return CATEGORY_ORDER.filter(function (category) {
      return grouped[category] && grouped[category].length;
    }).map(function (category) {
      return CATEGORY_LABELS[category] + ': ' + grouped[category].join(', ');
    }).join('\n\n');
  }

  function toPlannerPlan(model, result) {
    var mandatory = [];
    var conditional = [];
    var external = [];
    var emergency = [];
    (result.items || []).forEach(function (resultItem) {
      var isMandatory = MANDATORY.has(resultItem.status);
      var converted = convertItem(model, resultItem, isMandatory);
      if (resultItem.status === 'emergency') emergency.push(converted);
      else if (resultItem.availability === 'unavailable_external_route') external.push(converted);
      else if (isMandatory) mandatory.push(converted);
      else conditional.push(converted);
    });
    [mandatory, conditional, external, emergency].forEach(function (items) { items.sort(sortItems); });
    return {
      stage: result.stage,
      diagnoses: result.diagnoses || [],
      mandatory: mandatory,
      conditional: conditional,
      external: external,
      emergency: emergency,
      copyText: buildCopyText(mandatory.concat(emergency))
    };
  }

  return {
    toPlannerPlan: toPlannerPlan,
    categoryLabels: CATEGORY_LABELS
  };
});
