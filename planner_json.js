/* Рабочий планировщик на JSON-модели клинической матрицы. v2 — полный набор уточняющих вопросов. */
(function () {
  'use strict';

  var model;
  var selectedDiagnoses = new Set();
  var conditionValues = {};
  var diagnosticPathValue = 'none';
  var grid = document.getElementById('diagnosisGrid');
  var copyBlock = document.getElementById('copyBlock');
  var copyText = document.getElementById('copyText');
  var resultsWrap = document.getElementById('resultsWrap');
  var mandList = document.getElementById('mandatoryList');
  var condList = document.getElementById('conditionalList');
  var externalList = document.getElementById('externalList');
  var emergencyList = document.getElementById('emergencyList');
  var externalCard = document.getElementById('externalCard');
  var emergencyCard = document.getElementById('emergencyCard');
  var toggleMandatory = document.getElementById('toggleMandatoryBtn');
  var toggleConditional = document.getElementById('toggleConditionalBtn');
  var stageInput = document.getElementById('visitStage');
  var questions = document.getElementById('matrixQuestions');
  var status = document.getElementById('matrixStatus');
  var copyButton = document.getElementById('copyBtn');
  var lastCopyText = '';

  /* Вспомогательные установки условий */
  function setBool(key, value) {
    if (value === 'yes') conditionValues[key] = true;
    else if (value === 'no') conditionValues[key] = false;
    else delete conditionValues[key];
  }
  function clearAll(keys) {
    keys.forEach(function (key) { delete conditionValues[key]; });
  }

  /* Определения уточняющих вопросов.
     group — подпись раздела; dx — при каком диагнозе показывать;
     stages — ограничение по этапам (если задано);
     read — текущее значение для select; apply — запись ответа в состояние. */
  var questionDefs = [
    {
      group: 'Сердечная недостаточность', dx: ['heart_failure'],
      label: 'Статус ХСН',
      values: [['suspected', 'Подозрение'], ['established', 'Установлена']],
      read: function () {
        if (conditionValues.hf_status !== undefined) return conditionValues.hf_status;
        return selectedDiagnoses.has('heart_failure') ? 'established' : 'suspected';
      },
      apply: function (value) { conditionValues.hf_status = value; }
    },
    {
      group: 'Фибрилляция/трепетание предсердий', dx: ['atrial_fibrillation'],
      label: 'Антитромботическая терапия при ФП',
      values: [['doac', 'ПОАК'], ['warfarin', 'Варфарин'], ['not_prescribed_or_decision_pending', 'Не назначена / решение не принято']],
      read: function () { return conditionValues.antithrombotic_status === undefined ? 'doac' : conditionValues.antithrombotic_status; },
      apply: function (value) { conditionValues.antithrombotic_status = value; }
    },
    {
      group: 'Сахарный диабет 2 типа', dx: ['type2_diabetes'],
      label: 'Статус СД 2 типа',
      values: [['established', 'Установленный ранее'], ['newly_established', 'Впервые установлен'], ['suspected', 'Подозрение']],
      read: function () {
        if (conditionValues.diabetes_status !== undefined) return conditionValues.diabetes_status;
        return stageInput.value === 'primary_visit' ? 'suspected' : 'established';
      },
      apply: function (value) {
        conditionValues.diabetes_status = value;
        if (value !== 'suspected') diagnosticPathValue = 'none';
      }
    },
    {
      group: 'Сахарный диабет 2 типа', dx: ['type2_diabetes'],
      stages: ['primary_visit'],
      extraVisible: function () { return conditionValues.diabetes_status === 'suspected'; },
      label: 'Метод подтверждения диагноза СД',
      values: [['none', 'Не требуется на этом этапе'], ['glucose', 'Глюкоза плазмы'], ['hba1c', 'HbA1c'], ['ogtt', 'ПГТТ']],
      read: function () { return diagnosticPathValue; },
      apply: function (value) { diagnosticPathValue = value; }
    },
    {
      group: 'Сахарный диабет 2 типа', dx: ['type2_diabetes'],
      stages: ['worsening'],
      label: 'Признаки метаболической декомпенсации (кетоз)?',
      values: [['no', 'Нет'], ['yes', 'Да']],
      read: function () { return conditionValues.metabolic_decompensation === true ? 'yes' : 'no'; },
      apply: function (value) { setBool('metabolic_decompensation', value); }
    },
    {
      group: 'Хроническая болезнь почек', dx: ['ckd'],
      key: 'ckd_stage',
      label: 'Стадия ХБП',
      values: [['unknown', 'Не уточнена'], ['C1', 'C1'], ['C2', 'C2'], ['C3a', 'C3a'], ['C3b', 'C3b'], ['C4', 'C4'], ['C5', 'C5'], ['C5D', 'C5Д']],
      read: function () { return conditionValues.ckd_stage === undefined ? 'unknown' : conditionValues.ckd_stage; },
      apply: function (value) { conditionValues.ckd_stage = value; }
    },
    {
      group: 'Стабильная ИБС', dx: ['stable_ihd'],
      stages: ['worsening'],
      label: 'Подозрение на острый коронарный синдром?',
      values: [['no', 'Нет'], ['yes', 'Да — показана экстренная оценка']],
      read: function () { return conditionValues.acute_coronary_syndrome_suspected === true ? 'yes' : 'no'; },
      apply: function (value) { setBool('acute_coronary_syndrome_suspected', value); }
    }
  ];

  function selectedValues() { return Array.from(selectedDiagnoses); }
  function hasDiagnosis(id) { return selectedDiagnoses.has(id); }

  function defVisible(def) {
    var okDx = def.dx.some(hasDiagnosis);
    if (!okDx) return false;
    if (def.stages && def.stages.indexOf(stageInput.value) === -1) return false;
    if (def.extraVisible && !def.extraVisible()) return false;
    return true;
  }

  function renderQuestions() {
    questions.innerHTML = '';
    var lastGroup = null;
    questionDefs.forEach(function (def) {
      if (!defVisible(def)) return;
      def.apply(def.read());
      if (def.group !== lastGroup) {
        lastGroup = def.group;
        var heading = document.createElement('div');
        heading.textContent = def.group;
        heading.style.cssText = 'font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#0b5c8a;border-bottom:1px solid #e0e6ef;padding-bottom:4px;margin:4px 0 2px;grid-column:1/-1;';
        questions.appendChild(heading);
      }
      var label = document.createElement('label');
      label.className = 'matrix-question';
      label.textContent = def.label;
      var select = document.createElement('select');
      def.values.forEach(function (entry) {
        var option = document.createElement('option');
        option.value = entry[0];
        option.textContent = entry[1];
        select.appendChild(option);
      });
      select.value = def.read();
      select.addEventListener('change', function () {
        def.apply(select.value);
        renderQuestions();
        generatePlan();
      });
      label.appendChild(select);
      if (def.key === 'ckd_stage' && select.value === 'unknown') {
        select.style.borderColor = '#c2410c';
        var warn = document.createElement('span');
        warn.style.cssText = 'color:#c2410c;font-weight:600;font-size:12px;';
        warn.textContent = ' — выберите стадию';
        label.appendChild(warn);
      }
      questions.appendChild(label);
    });
    if (!questions.children.length) {
      var hint = document.createElement('div');
      hint.className = 'matrix-status';
      hint.textContent = 'Дополнительных уточняющих вопросов для выбранного набора нет.';
      questions.appendChild(hint);
    }
  }

  function renderDiagnosisGrid() {
    grid.innerHTML = '';
    model.diagnoses.forEach(function (diagnosis) {
      var label = document.createElement('label'); label.className = 'dx-check';
      var input = document.createElement('input'); input.type = 'checkbox'; input.dataset.dx = diagnosis.id;
      if (selectedDiagnoses.has(diagnosis.id)) { input.checked = true; label.classList.add('selected'); }
      var content = document.createElement('div'); content.innerHTML = '<div class="dx-name">' + diagnosis.label + '</div><div class="dx-code">' + diagnosis.code + '</div>';
      label.appendChild(input); label.appendChild(content);
      input.addEventListener('change', function () {
        if (input.checked) selectedDiagnoses.add(diagnosis.id); else selectedDiagnoses.delete(diagnosis.id);
        label.classList.toggle('selected', input.checked);
        renderQuestions();
        generatePlan();
      });
      grid.appendChild(label);
    });
  }

  function listItem(item, checked) {
    var label = document.createElement('label'); label.className = 'exam-item' + (checked ? ' checked' : '');
    var input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked; input.className = 'matrix-exam-check'; input.dataset.name = item.name; input.dataset.type = item.type; input.dataset.external = item.availability === 'unavailable_external_route' ? '1' : '0';
    var body = document.createElement('div');
    var note = item.availability === 'needs_confirmation' ? '<span class="avail-note">доступность уточняется</span>' : '';
    body.innerHTML = '<div class="exam-name">' + item.name + note + '</div>';
    var reasonsText = (item.reasons || []).filter(Boolean).join('; ');
    if (reasonsText) label.dataset.tip = reasonsText;
    label.appendChild(input); label.appendChild(body); input.addEventListener('change', function () { label.classList.toggle('checked', input.checked); updateCopy(); }); return label;
  }

  function renderList(container, items, checked, groupBy) {
    container.innerHTML = '';
    if (!items.length) { container.innerHTML = '<div class="copy-empty">Нет позиций</div>'; return; }
    var lastCat = null;
    var group = null;
    items.forEach(function (item) {
      if (groupBy && item.categoryLabel !== lastCat) {
        lastCat = item.categoryLabel;
        group = document.createElement('div');
        group.className = 'dx-group';
        var title = document.createElement('div');
        title.className = 'dx-group-title';
        title.textContent = item.categoryLabel;
        group.appendChild(title);
        container.appendChild(group);
      }
      (group || container).appendChild(listItem(item, checked));
    });
  }

  function updateCopy() {
    var grouped = { lab: [], instrumental: [], consultation: [], exam: [], calculation: [] };
    var externalChecked = [];
    document.querySelectorAll('.matrix-exam-check:checked').forEach(function (input) {
      if (input.dataset.external === '1') { externalChecked.push(input.dataset.name); return; }
      if (grouped[input.dataset.type]) grouped[input.dataset.type].push(input.dataset.name);
    });
    var labels = { lab: 'Лабораторные методы', instrumental: 'Инструментальные методы', consultation: 'Консультации специалистов', exam: 'Осмотры (проводит врач)', calculation: 'Расчётные показатели' };
    var parts = Object.keys(labels).filter(function (key) { return grouped[key].length; }).map(function (key) { return labels[key] + ': ' + grouped[key].join(', '); });
    if (externalChecked.length) parts.push('Также рекомендовано: ' + externalChecked.join(', '));
    lastCopyText = parts.join('\n\n');
    copyText.innerHTML = lastCopyText ? lastCopyText.replace(/\n/g, '<br>') : '<span class="copy-empty">Отметьте обследования ниже…</span>';
  }

  function generatePlan() {
    if (!selectedDiagnoses.size) { resultsWrap.classList.remove('visible'); copyBlock.classList.remove('visible'); return; }
    try {
      var scenario = {
        stage: stageInput.value,
        diagnoses: selectedValues(),
        conditions: Object.assign({}, conditionValues)
      };
      if (diagnosticPathValue !== 'none') scenario.diagnosticPath = diagnosticPathValue;
      ClinicalMatrixEngine.validateConditions(model);
      var evaluated = ClinicalMatrixEngine.evaluate(model, scenario);
      var plan = ClinicalMatrixAdapter.toPlannerPlan(model, evaluated);
      renderList(mandList, plan.mandatory, true, false);
      renderList(condList, plan.conditional, false, true);
      renderList(externalList, plan.external, false, true);
      renderList(emergencyList, plan.emergency, true, false);
      externalCard.style.display = plan.external.length ? '' : 'none';
      emergencyCard.style.display = plan.emergency.length ? '' : 'none';
      mandList.parentElement.closest('.section-card').style.display = plan.mandatory.length ? '' : 'none';
      condList.parentElement.closest('.section-card').style.display = plan.conditional.length ? '' : 'none';
      resultsWrap.classList.add('visible');
      copyBlock.classList.add('visible');
      updateCopy();
      status.textContent = 'План сформирован: обязательных — ' + plan.mandatory.length + ', дополнительных — ' + plan.conditional.length + (plan.external.length ? ', «также рекомендовано» — ' + plan.external.length : '') + (plan.emergency.length ? ', экстренных — ' + plan.emergency.length : '') + '.';
      status.className = 'matrix-status ok';
    } catch (error) {
      status.textContent = 'Ошибка: ' + error.message;
      status.className = 'matrix-status error';
      resultsWrap.classList.remove('visible');
      copyBlock.classList.remove('visible');
    }
  }

  function loadModel() {
    fetch('Клиническая матрица rules.json').then(function (response) {
      if (!response.ok) throw new Error('JSON-модель не загрузилась');
      return response.json();
    }).then(function (loaded) {
      model = loaded;
      ClinicalMatrixEngine.validateConditions(model);
      stageInput.innerHTML = '';
      model.clinicalStages.forEach(function (stage) {
        var option = document.createElement('option');
        option.value = stage.id;
        option.textContent = stage.label;
        stageInput.appendChild(option);
      });
      renderDiagnosisGrid();
      renderQuestions();
      status.textContent = 'JSON-модель загружена.';
      status.className = 'matrix-status ok';
    }).catch(function (error) {
      status.textContent = 'Ошибка загрузки JSON-модели: ' + error.message;
      status.className = 'matrix-status error';
    });
  }

  function toggleList(container, button) {
    var inputs = container.querySelectorAll('.matrix-exam-check');
    if (!inputs.length) return;
    var allChecked = Array.from(inputs).every(function (input) { return input.checked; });
    inputs.forEach(function (input) {
      input.checked = !allChecked;
      var item = input.closest('.exam-item');
      if (item) item.classList.toggle('checked', !allChecked);
    });
    button.textContent = allChecked ? 'Выбрать все' : 'Снять все';
    updateCopy();
  }

  toggleMandatory.addEventListener('click', function () { toggleList(mandList, toggleMandatory); });
  toggleConditional.addEventListener('click', function () { toggleList(condList, toggleConditional); });

  stageInput.addEventListener('change', function () { renderQuestions(); generatePlan(); });

  function copyToClipboard(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    if (!copied) { area.style.left = '0'; area.style.top = '0'; area.style.zIndex = '10000'; return false; }
    document.body.removeChild(area);
    return true;
  }

  copyButton.addEventListener('click', function () {
    if (!lastCopyText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastCopyText).then(function () {
        copyButton.textContent = 'Скопировано';
        setTimeout(function () { copyButton.textContent = 'Копировать'; }, 1800);
      }).catch(function () {
        if (copyToClipboard(lastCopyText)) { copyButton.textContent = 'Скопировано'; setTimeout(function () { copyButton.textContent = 'Копировать'; }, 1800); }
        else { copyButton.textContent = 'Текст выделен — нажмите Ctrl+C'; setTimeout(function () { copyButton.textContent = 'Копировать'; }, 4000); }
      });
    } else if (copyToClipboard(lastCopyText)) {
      copyButton.textContent = 'Скопировано';
      setTimeout(function () { copyButton.textContent = 'Копировать'; }, 1800);
    } else {
      copyButton.textContent = 'Текст выделен — нажмите Ctrl+C';
      setTimeout(function () { copyButton.textContent = 'Копировать'; }, 4000);
    }
  });

  loadModel();
})();
