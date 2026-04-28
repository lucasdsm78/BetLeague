from pydantic import BaseModel, Field


class ErrorMessageUserEmailAlreadyExists(BaseModel):
    detail: str


class ErrorMessageUsersNotFound(BaseModel):
    detail: str


class ErrorMessageUserNotFound(BaseModel):
    detail: str
