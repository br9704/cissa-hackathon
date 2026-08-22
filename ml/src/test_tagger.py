"""Tests for the parser and the scorer. Run: uv run python -m pytest src -q"""

from tagger import LABELS, UNPARSEABLE, parse, score


def test_parses_the_exact_contract():
    assert parse('{"label":"risk_limit","risk":true}') == ("risk_limit", True)


def test_tolerates_whitespace_and_a_code_fence():
    assert parse('```json\n{"label": "infra", "risk": false}\n```')[0] == "infra"


def test_ignores_a_trailing_sentence():
    # Models add explanations. The first balanced object is the answer.
    assert parse('{"label":"execution","risk":false} This is because...')[0] == "execution"


def test_refuses_an_unknown_label_rather_than_guessing():
    # A near miss is still not one of the seven classes, and mapping it to the closest one
    # is how a parser quietly invents accuracy.
    assert parse('{"label":"parameter","risk":true}')[0] == UNPARSEABLE


def test_refuses_prose():
    assert parse("This looks like a risk limit change.")[0] == UNPARSEABLE


def test_refuses_a_thinking_block_with_no_answer():
    # The failure mode that looks like a broken fine-tune and is actually a missing
    # enable_thinking flag.
    assert parse("<think>\nThe decision changes a threshold, so")[0] == UNPARSEABLE


def test_returns_none_for_a_missing_or_non_boolean_risk():
    assert parse('{"label":"infra"}') == ("infra", None)
    assert parse('{"label":"infra","risk":"yes"}') == ("infra", None)


def test_scoring_counts_unparseable_separately_from_wrong():
    truth = [("infra", True), ("infra", True), ("process", False)]
    predicted = [("infra", True), (UNPARSEABLE, None), ("infra", False)]
    s = score(truth, predicted)
    assert s.n == 3
    assert s.invalid_outputs == 1
    assert s.scored_on == 2
    # One of the two scoreable rows is right.
    assert s.accuracy == 0.5


def test_macro_f1_ignores_classes_with_no_examples():
    # Five of the seven classes are absent from this split. Giving them a free zero would
    # drag macro F1 down for a reason that has nothing to do with the model.
    truth = [("infra", True), ("process", False)]
    predicted = [("infra", True), ("process", False)]
    s = score(truth, predicted)
    assert s.macro_f1 == 1.0


def test_a_model_that_always_answers_one_class_scores_badly():
    # The specific thing the strict parser protects against: coercing to a default class
    # would make this look respectable.
    truth = [("infra", True)] * 8 + [("process", False)] * 2
    predicted = [("infra", True)] * 10
    s = score(truth, predicted)
    assert s.accuracy == 0.8
    assert s.macro_f1 < 0.5


def test_every_label_appears_in_the_system_prompt():
    from tagger import SYSTEM_PROMPT

    for label in LABELS:
        assert label in SYSTEM_PROMPT
