from flask import Blueprint

bp = Blueprint("main", __name__)

from app.routes import folders  # noqa: E402,F401
from app.routes import health  # noqa: E402,F401
from app.routes import nodes  # noqa: E402,F401
from app.routes import upload  # noqa: E402,F401
