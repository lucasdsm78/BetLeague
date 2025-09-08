import re
from dataclasses import dataclass

regex = r"([A-Za-z0-9]+[.-_])*[A-Za-z0-9]+@[A-Za-z0-9-]+(\.[A-Z|a-z]{2,})+"
pattern = re.compile(regex)


@dataclass(init=False, eq=True, frozen=True)
class Email:
    value: str

    def __init__(self, value: str):
        if pattern.match(value) is None:
            raise ValueError("email should be a valid format.")

        object.__setattr__(self, "value", value)
