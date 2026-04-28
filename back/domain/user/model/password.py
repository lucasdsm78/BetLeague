from dataclasses import dataclass


@dataclass(eq=True, frozen=True)
class Password:
    password: str
