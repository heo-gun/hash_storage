import logging
import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv


def create_app():
    load_dotenv()
    app = Flask(__name__)

    # CORS: 개발은 *, 프로덕션은 CORS_ORIGINS 환경변수로 도메인 제한
    cors_origins = os.getenv("CORS_ORIGINS", "*")
    CORS(app, origins=cors_origins.split(",") if cors_origins != "*" else "*")

    from app.routes import bp
    app.register_blueprint(bp)

    # 개발 환경에서 버킷 자동 생성 (프로덕션은 버킷이 이미 존재해야 함)
    if os.getenv("FLASK_ENV") != "production":
        try:
            from app.storage import ensure_bucket_exists
            ensure_bucket_exists()
        except Exception as e:
            logging.warning("ensure_bucket_exists failed (S3/MinIO 아직 미준비?): %s", e)

    return app
