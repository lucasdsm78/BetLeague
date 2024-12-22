from typing import Optional

from pydantic import Field, BaseModel

from app.domain.activity.model.activity import Activity
from app.domain.user.model.school import School


class LeagueReadModel(BaseModel):
    """ActivityReadModel represents data structure as a read model."""

    id: int
    type: str
    uuid: str
    school: int
    category: str
    name: str = Field(example="Sortie à la ptinoire")
    description: str = Field(example="Sortie à la patinoire à 12h00")
    start_date: int = Field(example=1136214245000)
    end_date: int = Field(example=1136214245000)
    place: str = Field(example="Cergy")
    image_activity: str = Field(example="url_image.png")
    max_members: int = Field(example=20)
    user_creator: int = Field(example=1)
    createdAt: int = Field(example=1136214245000)
    updatedAt: int = Field(example=1136214245000)
    is_participate: Optional[bool] = None

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity_get_all(activity: Activity) -> "ActivityReadModel":
        return ActivityReadModel(
            id=activity.id,
            uuid=activity.uuid,
            type=activity.type.value,
            category=activity.category.value,
            name=activity.name,
            school=activity.school,
            description=activity.description,
            start_date=activity.start_date,
            end_date=activity.end_date,
            place=activity.place,
            image_activity=activity.image_activity,
            max_members=activity.max_members,
            user_creator=activity.user.id,
            createdAt=activity.created_at,
            updatedAt=activity.updated_at
        )

    @staticmethod
    def from_entity_get_by_id(activity: Activity, is_participate: bool) -> "ActivityReadModel":
        return ActivityReadModel(
            id=activity.id,
            uuid=activity.uuid,
            type=activity.type.value,
            school=activity.school,
            category=activity.category.value,
            name=activity.name,
            description=activity.description,
            start_date=activity.start_date,
            end_date=activity.end_date,
            place=activity.place,
            image_activity=activity.image_activity,
            max_members=activity.max_members,
            user_creator=activity.user.id,
            createdAt=activity.created_at,
            updatedAt=activity.updated_at,
            is_participate=is_participate
        )
