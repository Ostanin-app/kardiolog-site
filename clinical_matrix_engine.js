/* Безопасный браузерный движок JSON-модели клинической матрицы. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClinicalMatrixEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRIORITY = {
    do_not_auto_add: 0,
    clinical_review_required: 1,
    consider: 2,
    symptom_dependent: 3,
    indicated_if_condition: 4,
    mandatory_if_condition: 5,
    mandatory_for_stage: 6,
    mandatory_for_situation: 7,
    emergency: 8
  };

  function has(scenario, key, value) {
    return scenario.conditions && scenario.conditions[key] === value;
  }
  function dx(scenario, id) { return (scenario.diagnoses || []).indexOf(id) !== -1; }
  function stage(scenario, id) { return scenario.stage === id; }
  function ckd345(scenario) { return ['C3', 'C3a', 'C3b', 'C4', 'C5', 'C5D'].indexOf(scenario.conditions && scenario.conditions.ckd_stage) !== -1; }

  var handlers = {
    selected_diagnostic_path: function (s) { return ['glucose', 'hba1c', 'ogtt'].indexOf(s.diagnosticPath) !== -1; },
    af_suspected_or_established: function (s) { return dx(s, 'atrial_fibrillation'); },
    established_af: function (s) { return dx(s, 'atrial_fibrillation'); },
    af_selected_safety_branch_active: function (s) { return dx(s, 'atrial_fibrillation'); },
    antithrombotic_status_is_doac: function (s) { return has(s, 'antithrombotic_status', 'doac'); },
    antithrombotic_status_is_warfarin: function (s) { return has(s, 'antithrombotic_status', 'warfarin'); },
    established_hf: function (s) { return has(s, 'hf_status', 'established'); },
    established_or_suspected_hf: function (s) { return ['established', 'suspected'].indexOf(s.conditions && s.conditions.hf_status) !== -1; },
    thyroid_disease_symptoms: function (s) { return has(s, 'thyroid_disease_symptoms', true); },
    hypertension_eye_screening_condition: function (s) { return has(s, 'hypertension_grade_2_or_3', true) || (dx(s, 'hypertension') && dx(s, 'type2_diabetes')); },
    statin_myopathy_symptoms: function (s) { return has(s, 'statin_myopathy_symptoms', true); },
    hf_suspected_in_ihd: function (s) { return ['established', 'suspected'].indexOf(s.conditions && s.conditions.hf_status) !== -1; },
    ihd_diabetes_screening_indicated: function (s) { return dx(s, 'type2_diabetes'); },
    progressive_ihd_or_revascularization_question: function (s) { return has(s, 'progressive_ihd_or_revascularization_question', true); },
    ptv_modification_question: function (s) { return has(s, 'ptv_modification_question', true); },
    ptv_over_15_or_high_risk: function (s) { return has(s, 'ptv_over_15_or_high_risk', true); },
    ptv_up_to_15_or_stress_contraindication: function (s) { return has(s, 'ptv_up_to_15_or_stress_contraindication', true); },
    established_hf_initial_assessment_or_current_worsening: function (s) { return (has(s, 'hf_status', 'established') && stage(s, 'initial_assessment')) || stage(s, 'worsening'); },
    established_hf_on_initial_assessment_or_current_worsening: function (s) { return (has(s, 'hf_status', 'established') && stage(s, 'initial_assessment')) || stage(s, 'worsening'); },
    routine_follow_up_without_renal_imaging_question: function (s) { return stage(s, 'follow_up') && !has(s, 'renal_imaging_question', true); },
    no_acidosis_or_stage_specific_control_question: function (s) { return !has(s, 'acidosis_or_stage_specific_control_question', true); },
    established_hf_initial_assessment: function (s) { return has(s, 'hf_status', 'established') && stage(s, 'initial_assessment'); },
    hf_suspected_or_primary_assessment_and_test_not_already_used: function (s) { return ['established', 'suspected'].indexOf(s.conditions && s.conditions.hf_status) !== -1 && !has(s, 'bnp_already_used', true); },
    type2_diabetes_and_no_urine_inflammation: function (s) { return dx(s, 'type2_diabetes') && !has(s, 'urine_inflammation', true); },
    diabetes_status_is_newly_established: function (s) { return has(s, 'diabetes_status', 'newly_established'); },
    established_type2_diabetes: function (s) { return ['established', 'newly_established'].indexOf(s.conditions && s.conditions.diabetes_status) !== -1; },
    diabetes_status_is_established: function (s) { return ['established', 'newly_established'].indexOf(s.conditions && s.conditions.diabetes_status) !== -1; },
    established_type2_diabetes_without_stage_specific_complication: function (s) { return ['established', 'newly_established'].indexOf(s.conditions && s.conditions.diabetes_status) !== -1 && !has(s, 'stage_specific_complication', true); },
    newly_established_or_established_type2_diabetes: function (s) { return ['established', 'newly_established'].indexOf(s.conditions && s.conditions.diabetes_status) !== -1; },
    metabolic_decompensation: function (s) { return has(s, 'metabolic_decompensation', true); },
    suspected_or_established_ckd: function (s) { return dx(s, 'ckd'); },
    suspected_or_established_ckd_and_no_urine_inflammation: function (s) { return dx(s, 'ckd') && !has(s, 'urine_inflammation', true); },
    suspected_or_established_ckd_primary_assessment: function (s) { return dx(s, 'ckd') && ['suspected_diagnosis', 'initial_assessment'].indexOf(s.stage) !== -1; },
    ckd_stage_is_C3_or_higher: ckd345,
    ckd_stage_is_C3_or_higher_and_stage_rule_active: ckd345,
    ckd_stage_C3_to_C5D_and_acidosis_or_stage_specific_control_question: function (s) { return ckd345(s) && has(s, 'acidosis_or_stage_specific_control_question', true); },
    acidosis_or_stage_specific_control_question: function (s) { return has(s, 'acidosis_or_stage_specific_control_question', true); },
    renovascular_hypertension_suspected: function (s) { return has(s, 'renovascular_hypertension_suspected', true); },
    ckd_plus_hypertension_and_control_question: function (s) { return dx(s, 'ckd') && dx(s, 'hypertension') && has(s, 'control_question', true); },
    acute_coronary_syndrome_suspected: function (s) { return has(s, 'acute_coronary_syndrome_suspected', true); },
    acute_coronary_syndrome_suspected_is_false: function (s) { return has(s, 'acute_coronary_syndrome_suspected', false); },
    arrhythmia_symptoms_or_unclear_rate_control: function (s) { return has(s, 'arrhythmia_symptoms', true) || has(s, 'unclear_rate_control', true); },
    arrhythmia_symptoms_is_false: function (s) { return has(s, 'arrhythmia_symptoms', false); },
    white_coat_masked_resistant_or_control_question: function (s) { return has(s, 'white_coat_or_masked_or_resistant', true) || has(s, 'control_question', true); },
    ecg_changes_or_left_ventricular_dysfunction_symptoms: function (s) { return has(s, 'ecg_changes', true) || has(s, 'left_ventricular_dysfunction_symptoms', true); },
    coronary_anatomy_question: function (s) { return has(s, 'coronary_anatomy_question', true); },
    htn_resistant_or_hypokalemia: function (s) { return has(s, 'htn_resistant_or_hypokalemia', true); },
    htn_crisis_like: function (s) { return has(s, 'htn_crisis_like', true); },
    htn_cushing_symptoms: function (s) { return has(s, 'htn_cushing_symptoms', true); },
    htn_adrenal_mass: function (s) { return has(s, 'htn_adrenal_mass', true); },
    htn_carotid_indication: function (s) { return has(s, 'htn_carotid_indication', true); },
    htn_renal_us_indication: function (s) { return has(s, 'htn_renal_us_indication', true); },
    htn_prediabetes_obesity: function (s) { return has(s, 'htn_prediabetes_obesity', true); },
    aorta_dilation_question: function (s) { return has(s, 'aorta_dilation_question', true); },
    htn_neurological_symptoms: function (s) { return has(s, 'htn_neurological_symptoms', true); },
    ag_endocrinologist_indicated: function (s) { return dx(s, 'type2_diabetes') || has(s, 'htn_resistant_or_hypokalemia', true) || has(s, 'htn_crisis_like', true) || has(s, 'htn_cushing_symptoms', true) || has(s, 'htn_prediabetes_obesity', true); },
    ckd_plus_hypertension: function (s) { return dx(s, 'ckd') && dx(s, 'hypertension'); },
    diagnostic_path_glucose: function (s) { return s.diagnosticPath === 'glucose'; },
    diagnostic_path_hba1c: function (s) { return s.diagnosticPath === 'hba1c'; },
    diagnostic_path_ogtt: function (s) { return s.diagnosticPath === 'ogtt'; }
  };

  function conditionMatches(condition, scenario) {
    if (condition === null || condition === undefined) return true;
    if (!handlers[condition]) throw new Error('Неизвестное условие правила: ' + condition);
    return handlers[condition](scenario);
  }

  function evaluate(model, scenario) {
    if (!scenario.stage || !(scenario.diagnoses || []).length) throw new Error('Сценарий должен содержать stage и diagnoses');
    var byExam = {};
    model.rules.forEach(function (rule) {
      if (scenario.diagnoses.indexOf(rule.diagnosisId) === -1 || rule.stageIds.indexOf(scenario.stage) === -1 || !conditionMatches(rule.condition, scenario)) return;
      (rule.examinationIds || [rule.examinationId]).forEach(function (examinationId) {
        var current = byExam[examinationId] || (byExam[examinationId] = { examinationId: examinationId, status: rule.status, autoSelected: Boolean(rule.autoSelect), reasons: [], ruleIds: [], sourceIds: [] });
        if (PRIORITY[rule.status] > PRIORITY[current.status]) current.status = rule.status;
        current.autoSelected = current.autoSelected || Boolean(rule.autoSelect);
        current.reasons.push(rule.reason || '');
        if (current.ruleIds.indexOf(rule.id) === -1) current.ruleIds.push(rule.id);
        if (current.sourceIds.indexOf(rule.sourceId) === -1) current.sourceIds.push(rule.sourceId);
      });
    });
    model.suppressionRules.forEach(function (suppression) {
      if (!conditionMatches(suppression.when, scenario)) return;
      (suppression.suppressRuleIds || []).forEach(function (ruleId) {
        Object.keys(byExam).forEach(function (id) {
          if (byExam[id].ruleIds.length === 1 && byExam[id].ruleIds[0] === ruleId) byExam[id].suppressed = true;
        });
      });
    });
    var examinations = {};
    model.examinations.forEach(function (entry) { examinations[entry.id] = entry; });
    var items = Object.keys(byExam).filter(function (id) { return !byExam[id].suppressed; }).map(function (id) {
      var item = byExam[id];
      item.label = examinations[id].label;
      item.availability = examinations[id].availability;
      return item;
    });
    return { stage: scenario.stage, diagnoses: scenario.diagnoses.slice(), items: items };
  }

  function validateConditions(model) {
    var conditions = [];
    model.rules.concat(model.suppressionRules).forEach(function (rule) { if (rule.condition || rule.when) conditions.push(rule.condition || rule.when); });
    var unknown = conditions.filter(function (condition, index) { return conditions.indexOf(condition) === index && !handlers[condition]; });
    if (unknown.length) throw new Error('Необработанные условия: ' + unknown.join(', '));
    return { conditionCount: conditions.filter(function (c, i) { return conditions.indexOf(c) === i; }).length, unknown: [] };
  }

  return { evaluate: evaluate, validateConditions: validateConditions };
});
