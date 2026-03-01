from enum import Enum


class BetType(str, Enum):
    MATCH_WINNER = "match_winner"
    GOALS_OVER_UNDER = "goals_over_under"
    BOTH_TEAMS_SCORE = "both_teams_score"
    EXACT_SCORE = "exact_score"
    DOUBLE_CHANCE = "double_chance"
    ODD_EVEN = "odd_even"
    EXACT_GOALS_NUMBER = "exact_goals_number"
