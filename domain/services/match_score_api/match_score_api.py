from abc import ABC, abstractmethod


class MatchScoreApi(ABC):

    @abstractmethod
    def get_matches_finished(self):
        raise NotImplementedError
