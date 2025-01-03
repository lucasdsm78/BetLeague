import logging
import requests
from pydantic import BaseModel, ValidationError

from domain.services.match_score_api.match_score_api import MatchScoreApi
from infrastructure.config import Settings


class MatchScoreApiImpl(MatchScoreApi, BaseModel):
    settings: Settings

    def get_matches_finished(self):
        url = self.settings.url_api_football_data
        headers = {
            "X-Auth-Token": self.settings.api_football_data_token,
            "Accept": "application/json"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()

            try:
                data = response.json()
            except ValueError as json_error:
                logging.error(f"Failed to parse JSON response: {json_error}")
                return []

            matches_data = data.get("matches", [])
            if not isinstance(matches_data, list):
                logging.warning("No matches found or 'matches' key is malformed.")
                return []

            finished_matches = []
            for match in matches_data:
                home_team = match.get("homeTeam", {})
                away_team = match.get("awayTeam", {})
                score_info = match.get("score", {})

                finished_matches.append({
                    "homeTeam": {
                        "id": home_team.get("id"),
                        "name": home_team.get("name"),
                        "shortName": home_team.get("shortName"),
                        "tla": home_team.get("tla"),
                        "crest": home_team.get("crest")
                    },
                    "awayTeam": {
                        "id": away_team.get("id"),
                        "name": away_team.get("name"),
                        "shortName": away_team.get("shortName"),
                        "tla": away_team.get("tla"),
                        "crest": away_team.get("crest")
                    },
                    "score": {
                        "winner": score_info.get("winner"),
                        "fullTime": {
                            "home": score_info.get("fullTime", {}).get("home"),
                            "away": score_info.get("fullTime", {}).get("away"),
                        },
                        "halfTime": {
                            "home": score_info.get("halfTime", {}).get("home"),
                            "away": score_info.get("halfTime", {}).get("away"),
                        },
                    }
                })

            return finished_matches

        except requests.exceptions.HTTPError as http_err:
            logging.error(f"HTTP error occurred: {http_err}")
        except requests.exceptions.Timeout as timeout_err:
            logging.error(f"Request timed out: {timeout_err}")
        except requests.exceptions.RequestException as req_err:
            logging.error(f"Request error occurred: {req_err}")
        except ValidationError as val_err:
            logging.error(f"Data validation error: {val_err}")

        return []
