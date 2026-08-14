from flask import Blueprint, g, jsonify, request

from auth import require_auth
from extensions import db
from models import Project

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


@bp.get("")
@require_auth
def list_projects():
    projects = Project.query.filter_by(user_id=g.user_id).order_by(Project.updated_at.desc()).all()
    return jsonify([p.to_summary() for p in projects])


@bp.get("/<uuid:project_id>")
@require_auth
def get_project(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user_id).first()
    if not project:
        return jsonify({"error": "not found"}), 404
    return jsonify(project.to_full())


@bp.post("")
@require_auth
def create_project():
    body = request.get_json(force=True) or {}
    data = body.get("data")
    if data is None:
        return jsonify({"error": "data is required"}), 400

    name = (body.get("name") or "Untitled Project").strip() or "Untitled Project"

    project = Project(user_id=g.user_id, name=name, data=data)
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_full()), 201


@bp.put("/<uuid:project_id>")
@require_auth
def update_project(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user_id).first()
    if not project:
        return jsonify({"error": "not found"}), 404

    body = request.get_json(force=True) or {}
    if "name" in body:
        project.name = (body["name"] or "Untitled Project").strip() or "Untitled Project"
    if "data" in body:
        project.data = body["data"]

    db.session.commit()
    return jsonify(project.to_full())


@bp.delete("/<uuid:project_id>")
@require_auth
def delete_project(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user_id).first()
    if not project:
        return jsonify({"error": "not found"}), 404

    db.session.delete(project)
    db.session.commit()
    return "", 204
