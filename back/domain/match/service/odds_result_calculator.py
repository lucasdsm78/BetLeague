from domain.match.model.bet_type import BetType

WIN = "WIN"
LOSE = "LOSE"


def calculate_result(bet_type: BetType, value: str, score_home: int, score_away: int) -> str:
    total = score_home + score_away

    if bet_type == BetType.MATCH_WINNER:
        return _match_winner(value, score_home, score_away)

    if bet_type == BetType.GOALS_OVER_UNDER:
        return _goals_over_under(value, total)

    if bet_type == BetType.BOTH_TEAMS_SCORE:
        return _both_teams_score(value, score_home, score_away)

    if bet_type == BetType.EXACT_SCORE:
        return _exact_score(value, score_home, score_away)

    if bet_type == BetType.DOUBLE_CHANCE:
        return _double_chance(value, score_home, score_away)

    if bet_type == BetType.ODD_EVEN:
        return _odd_even(value, total)

    if bet_type == BetType.EXACT_GOALS_NUMBER:
        return _exact_goals_number(value, total)

    return LOSE


def _match_winner(value: str, sh: int, sa: int) -> str:
    if value == "Home":
        return WIN if sh > sa else LOSE
    if value == "Draw":
        return WIN if sh == sa else LOSE
    if value == "Away":
        return WIN if sh < sa else LOSE
    return LOSE


def _goals_over_under(value: str, total: int) -> str:
    # value format: "Over 2.5" or "Under 2.5"
    parts = value.split()
    if len(parts) != 2:
        return LOSE
    direction = parts[0]
    try:
        threshold = float(parts[1])
    except ValueError:
        return LOSE
    if direction == "Over":
        return WIN if total > threshold else LOSE
    if direction == "Under":
        return WIN if total < threshold else LOSE
    return LOSE


def _both_teams_score(value: str, sh: int, sa: int) -> str:
    both_scored = sh > 0 and sa > 0
    if value == "Yes":
        return WIN if both_scored else LOSE
    if value == "No":
        return WIN if not both_scored else LOSE
    return LOSE


def _exact_score(value: str, sh: int, sa: int) -> str:
    # value format: "2:1" or "2-1"
    sep = ":" if ":" in value else "-"
    parts = value.split(sep)
    if len(parts) != 2:
        return LOSE
    try:
        expected_h, expected_a = int(parts[0].strip()), int(parts[1].strip())
    except ValueError:
        return LOSE
    return WIN if sh == expected_h and sa == expected_a else LOSE


def _double_chance(value: str, sh: int, sa: int) -> str:
    v = value.lower().replace("/", "").replace(" ", "")
    if v in ("homedraw", "1x", "home/draw"):
        return WIN if sh >= sa else LOSE
    if v in ("drawaway", "x2", "draw/away"):
        return WIN if sh <= sa else LOSE
    if v in ("homeaway", "12", "home/away"):
        return WIN if sh != sa else LOSE
    # Try the API format: "Home/Draw", "Draw/Away", "Home/Away"
    vl = value.lower()
    if "home" in vl and "draw" in vl:
        return WIN if sh >= sa else LOSE
    if "draw" in vl and "away" in vl:
        return WIN if sh <= sa else LOSE
    if "home" in vl and "away" in vl:
        return WIN if sh != sa else LOSE
    return LOSE


def _odd_even(value: str, total: int) -> str:
    if value == "Odd":
        return WIN if total % 2 == 1 else LOSE
    if value == "Even":
        return WIN if total % 2 == 0 else LOSE
    return LOSE


def _exact_goals_number(value: str, total: int) -> str:
    # value format: "2" or "6+" (for 6 or more)
    v = value.strip()
    if v.endswith("+"):
        try:
            threshold = int(v[:-1])
        except ValueError:
            return LOSE
        return WIN if total >= threshold else LOSE
    try:
        expected = int(v)
    except ValueError:
        return LOSE
    return WIN if total == expected else LOSE
