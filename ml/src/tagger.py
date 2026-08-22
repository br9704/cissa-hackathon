"""
Shared pieces: the prompt contract, the parser, and the scoring.

The parser is the part worth reading. It refuses rather than guesses, and that refusal is
what makes the reported number mean anything.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

LABELS = [
    "parameter_change",
    "risk_limit",
    "data_handling",
    "execution",
    "universe",
    "infra",
    "process",
]

SYSTEM_PROMPT = (
    "You classify a decision record from a quantitative trading desk. "
    "Reply with one line of JSON and nothing else. "
    'Format: {"label":"<class>","risk":<true|false>} '
    "Classes: " + ", ".join(LABELS) + ". "
    "risk is true when the decision changes the firm's risk posture or was made in "
    "response to a risk event."
)

UNPARSEABLE = "UNPARSEABLE"


def parse(raw: str) -> tuple[str, bool | None]:
    """
    Strict. Anything that is not one line of the expected JSON with a known label is
    UNPARSEABLE, and UNPARSEABLE is reported rather than coerced.

    Falling back to a default class would be easy and would corrupt every number that
    comes after it: it imports the majority class as a free win, inflates accuracy, and
    hides exactly the template bugs this parser exists to surface. A model that cannot
    follow the output contract has not classified anything, and saying so is the honest
    result.
    """
    text = raw.strip()

    # The model sometimes wraps the object in a fence or adds a trailing sentence. Take
    # the first balanced object and ignore the rest; anything before it is not an answer.
    start = text.find("{")
    end = text.find("}", start)
    if start == -1 or end == -1:
        return UNPARSEABLE, None

    try:
        obj = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return UNPARSEABLE, None

    if not isinstance(obj, dict):
        return UNPARSEABLE, None

    label = obj.get("label")
    if label not in LABELS:
        return UNPARSEABLE, None

    risk = obj.get("risk")
    return label, risk if isinstance(risk, bool) else None


@dataclass
class ClassScore:
    label: str
    precision: float
    recall: float
    f1: float
    support: int


@dataclass
class Scores:
    n: int
    invalid_outputs: int
    scored_on: int
    accuracy: float
    macro_f1: float
    risk_accuracy: float
    per_class: list[ClassScore] = field(default_factory=list)
    confusion: dict[str, dict[str, int]] = field(default_factory=dict)


def score(
    truth: list[tuple[str, bool]],
    predicted: list[tuple[str, bool | None]],
) -> Scores:
    """
    Macro F1 over the seven classes, plus accuracy on the boolean.

    Unparseable outputs are counted and then EXCLUDED from the class metrics rather than
    scored as wrong. Scoring them as wrong would blend two different failures, a model
    that classified badly and a model that did not answer, into one number that describes
    neither. Both are reported, so a reader can combine them if they want to.
    """
    assert len(truth) == len(predicted)

    invalid = sum(1 for p in predicted if p[0] == UNPARSEABLE)
    pairs = [(t, p) for t, p in zip(truth, predicted) if p[0] != UNPARSEABLE]

    confusion: dict[str, dict[str, int]] = {a: {b: 0 for b in LABELS} for a in LABELS}
    for (t_label, _), (p_label, _) in pairs:
        confusion[t_label][p_label] += 1

    per_class: list[ClassScore] = []
    f1s: list[float] = []
    for label in LABELS:
        tp = confusion[label][label]
        fp = sum(confusion[other][label] for other in LABELS if other != label)
        fn = sum(confusion[label][other] for other in LABELS if other != label)
        support = tp + fn
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class.append(ClassScore(label, precision, recall, f1, support))
        # A class with no examples in the split contributes nothing rather than a free
        # zero, which would drag macro F1 down for a reason unrelated to the model.
        if support:
            f1s.append(f1)

    correct = sum(1 for (t, _), (p, _) in pairs if t == p)
    risk_pairs = [(t[1], p[1]) for t, p in pairs if p[1] is not None]
    risk_correct = sum(1 for t, p in risk_pairs if t == p)

    return Scores(
        n=len(truth),
        invalid_outputs=invalid,
        scored_on=len(pairs),
        accuracy=correct / len(pairs) if pairs else 0.0,
        macro_f1=sum(f1s) / len(f1s) if f1s else 0.0,
        risk_accuracy=risk_correct / len(risk_pairs) if risk_pairs else 0.0,
        per_class=per_class,
        confusion=confusion,
    )
