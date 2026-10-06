from pydantic import BaseModel, ConfigDict, Field

from shaktios_api.report_contracts import Category, Urgency


class PriorityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    category: Category
    description: str = Field(min_length=1, max_length=500)
    has_photo: bool = False


class PriorityAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    suggested_urgency: Urgency
    priority: bool
    reasons: list[str] = Field(max_length=3)
