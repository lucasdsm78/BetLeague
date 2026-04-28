from pydantic import BaseModel, Field


class ErrorMessageMatchesNotFound(BaseModel):
    detail: str
