from difflib import SequenceMatcher


def are_similar(str1: str, str2: str, threshold: float = 0.7) -> bool:
    ratio = SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
    return ratio >= threshold
