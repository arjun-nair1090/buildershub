from fastapi.exceptions import RequestValidationError


def field_error(field: str, message: str) -> RequestValidationError:
    """A 422 in the same {detail, fields} shape as request validation, for rules that need the database."""
    return RequestValidationError([{"type": "value_error", "loc": ("body", field), "msg": message, "input": None}])
