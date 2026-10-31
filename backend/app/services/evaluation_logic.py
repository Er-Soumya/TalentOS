"""Pure candidate-evaluation maths: rating scores, overall score, recommendation, pipeline stages."""
STAGES = ["screening", "submitted", "interviewed", "selected", "offered", "joined"]
ALL_STAGES = STAGES + ["rejected"]
ROUNDS = ("hr", "technical", "managerial")
RATING_VALUES = {"Excellent": 100, "Good": 75, "Average": 50, "Poor": 25}


def score_ratings(ratings, expected_count):
    """ratings: {"0": "Good", ...}. Every question must be rated. Returns the average score (0-100)."""
    if not isinstance(ratings, dict) or len(ratings) != expected_count or expected_count < 1:
        raise ValueError(f"Please rate all {expected_count} questions")
    vals = []
    for k, v in ratings.items():
        if v not in RATING_VALUES:
            raise ValueError(f"Invalid rating '{v}' for question {k}")
        vals.append(RATING_VALUES[v])
    return sum(vals) / len(vals)


def rating_label(score):
    return "Excellent" if score >= 88 else "Good" if score >= 63 else "Average" if score >= 38 else "Poor"


def summarize(match, ats, round_scores):
    """round_scores: {"hr": 75, "technical": 85}. Overall = 35% match + 50% interview ratings + 15% ATS
    (ATS missing -> the other two are re-weighted). Recommended when overall >= 65 and interview average >= 60."""
    vals = [v for v in round_scores.values() if v is not None]
    ev_avg = int(round(sum(vals) / len(vals))) if vals else 0
    m = match or 0
    if ats is not None:
        overall = int(round(m * 0.35 + ev_avg * 0.5 + ats * 0.15))
    else:
        overall = int(round((m * 0.35 + ev_avg * 0.5) / 0.85))
    return {"evaluation_avg": ev_avg, "overall": overall, "recommended": overall >= 65 and ev_avg >= 60}


EVAL_STAGES = ["screening", "submitted", "interviewed", "selected"]


def next_stage(stage):
    """A 'go ahead' decision after an evaluation round moves the candidate one step:
    screening -> submitted -> interviewed -> selected (three rounds = three steps).
    'offered' and 'joined' are NOT set here: that is done on the Offers & Joining page."""
    if stage not in EVAL_STAGES:
        return stage
    return EVAL_STAGES[min(EVAL_STAGES.index(stage) + 1, len(EVAL_STAGES) - 1)]


def offer_action(stage, action, rounds_done):
    """Check an action from the Offers & Joining page and return the candidate's new stage.
    action: 'send' (send the offer), 'join' (confirm joining) or 'decline'. Raises ValueError with a message for the HR."""
    if action == "send":
        if stage != "selected":
            raise ValueError("Only selected candidates (who passed every round) can receive an offer")
        if not set(ROUNDS) <= set(rounds_done):
            raise ValueError("This candidate has not completed all three rounds (HR, Technical and Managerial)")
        return "offered"
    if action == "join":
        if stage != "offered":
            raise ValueError("Only candidates who have an offer can be marked as joined")
        return "joined"
    if action == "decline":
        if stage not in ("selected", "offered"):
            raise ValueError("There is nothing to decline for this candidate")
        return "rejected"
    raise ValueError("Unknown action")
