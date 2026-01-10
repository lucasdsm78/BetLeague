class DuplicateMatchChoiceError(Exception):

    message = "Un match ne peut pas apparaître deux fois dans le même ticket."

    def __str__(self) -> str:
        return self.message

