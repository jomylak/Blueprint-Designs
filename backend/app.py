from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from extensions import db
from routes import bp as projects_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    CORS(app, origins=Config.ALLOWED_ORIGINS, supports_credentials=False)
    app.register_blueprint(projects_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
