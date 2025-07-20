from fuzzywuzzy import fuzz


def are_similar(str1: str, str2: str, threshold: int = 70) -> bool:
    score = fuzz.partial_ratio(str1.lower(), str2.lower())
    return score >= threshold
