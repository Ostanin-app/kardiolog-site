/* Помощник по выбору кода МКБ-10: движок таблиц решений.
   Данные (вопросы, таблица, коды) лежат отдельно — в mkb_codes.json.
   Движок не содержит клинических сведений: только обход таблицы. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MkbEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function questionValues(question) {
    if (!question) return [];
    if (question.type === 'bool') return [true, false];
    return (question.values || []).map(function (entry) { return entry.value; });
  }

  function answerKnown(answers, qid) {
    return Object.prototype.hasOwnProperty.call(answers, qid) && answers[qid] !== null && answers[qid] !== undefined;
  }

  function rowMatches(row, answers) {
    var when = row.when || {};
    return Object.keys(when).every(function (qid) {
      var answer = Object.prototype.hasOwnProperty.call(answers, qid) ? answers[qid] : undefined;
      if (answer === undefined || answer === null) return true;
      return answer === when[qid];
    });
  }

  function candidates(model, tableId, answers) {
    var table = model.tables[tableId];
    if (!table) throw new Error('Неизвестная таблица: ' + tableId);
    return table.rows.filter(function (row) { return rowMatches(row, answers); });
  }

  function signature(model, tableId, qid, answers, value) {
    var probe = {};
    Object.keys(answers).forEach(function (key) { probe[key] = answers[key]; });
    probe[qid] = value;
    return candidates(model, tableId, probe).map(function (row) { return row.code; }).sort().join('|');
  }

  /* Вопрос имеет смысл, только если разные ответы приводят к разным наборам кодов. */
  function questionMatters(model, tableId, qid, answers) {
    var table = model.tables[tableId];
    if ((table.questionOrder || []).indexOf(qid) === -1) return false;
    var signs = questionValues(model.questions[qid]).map(function (value) {
      return signature(model, tableId, qid, answers, value);
    });
    return signs.some(function (s) { return s !== signs[0]; });
  }

  function nextQuestion(model, tableId, answers) {
    var table = model.tables[tableId];
    var order = table.questionOrder || [];
    for (var i = 0; i < order.length; i++) {
      var qid = order[i];
      if (Object.prototype.hasOwnProperty.call(answers, qid)) continue;
      if (questionMatters(model, tableId, qid, answers)) return qid;
    }
    return null;
  }

  function uniqueCodes(rows) {
    var seen = {};
    var out = [];
    rows.forEach(function (row) {
      if (!seen[row.code]) { seen[row.code] = true; out.push(row.code); }
    });
    return out;
  }

  /* Все комбинации ответов на «не уточнено» — чтобы показать, какие коды ещё возможны. */
  function resolve(model, tableId, answers) {
    var rows = candidates(model, tableId, answers);
    if (!rows.length) return { status: 'impossible', tableId: tableId, answers: answers };
    var codes = uniqueCodes(rows);
    var unknowns = Object.keys(answers).filter(function (qid) { return answers[qid] === null; });
    if (codes.length === 1) {
      return {
        status: 'code',
        tableId: tableId,
        code: codes[0],
        row: rows.filter(function (row) { return row.code === codes[0]; })[0],
        rows: rows,
        unknowns: unknowns
      };
    }
    var question = nextQuestion(model, tableId, answers);
    if (question) return { status: 'question', tableId: tableId, question: question, answers: answers, candidates: codes };
    return { status: 'ambiguous', tableId: tableId, codes: codes, rows: rows, answers: answers, unknowns: unknowns };
  }

  function codeOf(model, codeId) {
    return (model.codes || []).filter(function (entry) { return entry.code === codeId; })[0] || null;
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[a-z]/g, function (ch) { return ch; });
  }

  function searchCodes(model, query, groupId) {
    var q = normalize(query).trim();
    return (model.codes || []).filter(function (entry) {
      if (groupId && (entry.groups || []).indexOf(groupId) === -1) return false;
      if (!q) return true;
      var haystack = [entry.code, entry.label].concat(entry.synonyms || []).map(normalize).join(' | ');
      return q.split(/\s+/).every(function (part) { return haystack.indexOf(part) !== -1; });
    });
  }

  function codesOfGroup(model, groupId) {
    return searchCodes(model, '', groupId);
  }

  /* Объяснение: какие ответы привели к коду. */
  function explain(model, tableId, answers) {
    var table = model.tables[tableId];
    var out = [];
    (table.questionOrder || []).forEach(function (qid) {
      if (!Object.prototype.hasOwnProperty.call(answers, qid)) return;
      var question = model.questions[qid];
      var value = answers[qid];
      var text;
      if (value === null) text = 'не уточнено';
      else if (question.type === 'bool') text = value ? (question.whyTrue || 'да') : (question.whyFalse || 'нет');
      else {
        var entry = (question.values || []).filter(function (item) { return item.value === value; })[0];
        text = entry ? (entry.why || entry.label) : String(value);
      }
      out.push({ id: qid, label: question.label, value: value, text: text });
    });
    return out;
  }

  function parseHash(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw) return null;
    var parts = raw.split('/');
    var categoryId = decodeURIComponent(parts[0] || '');
    var answers = {};
    if (parts[1]) {
      parts[1].split(',').forEach(function (pair) {
        if (!pair) return;
        var index = pair.indexOf('=');
        if (index === -1) return;
        var key = decodeURIComponent(pair.slice(0, index));
        var value = decodeURIComponent(pair.slice(index + 1));
        if (value === '?') answers[key] = null;
        else if (value === '1' || value === 'true') answers[key] = true;
        else if (value === '0' || value === 'false') answers[key] = false;
        else answers[key] = value;
      });
    }
    return { categoryId: categoryId, answers: answers };
  }

  function buildHash(categoryId, answers) {
    var pairs = Object.keys(answers || {}).filter(function (qid) {
      return answers[qid] !== undefined;
    }).map(function (qid) {
      var value = answers[qid];
      var text = value === null ? '?' : (value === true ? '1' : value === false ? '0' : String(value));
      return encodeURIComponent(qid) + '=' + (value === null ? '?' : encodeURIComponent(text));
    });
    return '#' + encodeURIComponent(categoryId) + (pairs.length ? '/' + pairs.join(',') : '');
  }

  /* Полная проверка данных: используется тестом и при загрузке страницы. */
  function validate(model) {
    var problems = [];
    function unique(values, what) {
      var seen = {};
      values.forEach(function (value) {
        if (seen[value]) problems.push('Дубль ' + what + ': ' + value);
        seen[value] = true;
      });
    }
    if (!model || !model.categories || !model.codes || !model.questions || !model.tables) {
      return { problems: ['Модель не содержит обязательных разделов'] };
    }
    unique(model.categories.map(function (c) { return c.id; }), 'категории');
    unique(model.codes.map(function (c) { return c.code; }), 'кода');
    unique(Object.keys(model.questions), 'вопроса');
    unique((model.openQuestions || []).map(function (q) { return q.id; }), 'открытого вопроса');

    var openIds = (model.openQuestions || []).map(function (q) { return q.id; });

    model.codes.forEach(function (entry) {
      if (!entry.label) problems.push(entry.code + ': нет формулировки');
      if (!(entry.groups || []).length) problems.push(entry.code + ': не указана категория');
      (entry.groups || []).forEach(function (groupId) {
        if (!model.categories.some(function (c) { return c.id === groupId; })) {
          problems.push(entry.code + ': неизвестная категория ' + groupId);
        }
      });
    });

    model.categories.forEach(function (category) {
      if (category.kind === 'list') {
        var list = codesOfGroup(model, category.id);
        if (!list.length) problems.push('Категория ' + category.id + ': нет кодов');
      }
      if (category.kind === 'decision') {
        var table = model.tables[category.tableId];
        if (!table) { problems.push('Категория ' + category.id + ': нет таблицы ' + category.tableId); return; }
        var order = table.questionOrder || [];
        if (!order.length) problems.push('Таблица ' + category.tableId + ': пустой порядок вопросов');
        order.forEach(function (qid) {
          if (!model.questions[qid]) problems.push('Таблица ' + category.tableId + ': неизвестный вопрос ' + qid);
        });
        table.rows.forEach(function (row, index) {
          if (!codeOf(model, row.code)) problems.push('Таблица ' + category.tableId + ' строка ' + index + ': нет кода ' + row.code);
          Object.keys(row.when || {}).forEach(function (qid) {
            var question = model.questions[qid];
            if (!question) { problems.push('Строка ' + row.code + ': неизвестный вопрос ' + qid); return; }
            if (order.indexOf(qid) === -1) problems.push('Строка ' + row.code + ': вопрос ' + qid + ' отсутствует в questionOrder');
            var value = row.when[qid];
            if (question.type === 'bool' && typeof value !== 'boolean') problems.push('Строка ' + row.code + ': ' + qid + ' должен быть true/false');
            if (question.type === 'enum' && questionValues(question).indexOf(value) === -1) {
              problems.push('Строка ' + row.code + ': значение ' + value + ' не описано в вопросе ' + qid);
            }
          });
          if (row.openQuestionId && openIds.indexOf(row.openQuestionId) === -1) {
            problems.push('Строка ' + row.code + ': неизвестный открытый вопрос ' + row.openQuestionId);
          }
        });
        var seenRows = {};
        table.rows.forEach(function (row) {
          var key = row.code + '|' + JSON.stringify(row.when);
          if (seenRows[key]) problems.push('Таблица ' + category.tableId + ': дубль строки ' + key);
          seenRows[key] = true;
        });
      }
    });

    Object.keys(model.questions).forEach(function (qid) {
      var question = model.questions[qid];
      if (!question.label) problems.push('Вопрос ' + qid + ': нет формулировки');
      if (!question.tooltip) problems.push('Вопрос ' + qid + ': нет подсказки');
      if (question.type === 'enum' && !(question.values || []).length) problems.push('Вопрос ' + qid + ': нет вариантов');
      if (question.openQuestionId && openIds.indexOf(question.openQuestionId) === -1) {
        problems.push('Вопрос ' + qid + ': неизвестный открытый вопрос ' + question.openQuestionId);
      }
    });

    /* Перебор всех комбинаций ответов: поток обязан завершаться кодом или списком кандидатов. */
    model.categories.filter(function (c) { return c.kind === 'decision'; }).forEach(function (category) {
      var table = model.tables[category.tableId];
      if (!table) return;
      var trails = [{}];
      (table.questionOrder || []).forEach(function (qid) {
        var question = model.questions[qid];
        if (!question) return;
        var values = questionValues(question).concat([null]);
        var next = [];
        trails.forEach(function (base) {
          values.forEach(function (value) {
            var copy = {};
            Object.keys(base).forEach(function (key) { copy[key] = base[key]; });
            copy[qid] = value;
            next.push(copy);
          });
        });
        trails = next;
      });
      trails.forEach(function (answers) {
        var result = resolve(model, category.tableId, answers);
        if (result.status === 'impossible') problems.push('Нет кода для ответов ' + JSON.stringify(answers));
        if (result.status === 'question') problems.push('Вопрос ' + result.question + ' остался без ответа в ' + JSON.stringify(answers));
        if (result.status === 'code' && !codeOf(model, result.code)) problems.push('Получен неизвестный код ' + result.code);
      });
      var used = {};
      (table.questionOrder || []).forEach(function (qid) {
        trails.some(function (answers) {
          var rest = {};
          Object.keys(answers).forEach(function (key) { if (key !== qid) rest[key] = answers[key]; });
          if (questionMatters(model, category.tableId, qid, rest)) { used[qid] = true; return true; }
          return false;
        });
        if (!used[qid]) problems.push('Вопрос ' + qid + ' ни на что не влияет в таблице ' + category.tableId);
      });
    });

    return { problems: problems };
  }

  return {
    validate: validate,
    candidates: candidates,
    nextQuestion: nextQuestion,
    questionMatters: questionMatters,
    resolve: resolve,
    explain: explain,
    codeOf: codeOf,
    searchCodes: searchCodes,
    codesOfGroup: codesOfGroup,
    parseHash: parseHash,
    buildHash: buildHash,
    questionValues: questionValues
  };
});
