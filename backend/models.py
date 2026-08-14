from extensions import db
from sqlalchemy.dialects.postgresql import JSONB, UUID


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=db.text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True), nullable=False, index=True)
    name = db.Column(db.Text, nullable=False)
    data = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now(), nullable=False
    )

    def to_summary(self):
        regions = (self.data or {}).get("regions") or []
        materials = (self.data or {}).get("materials") or []
        material_by_id = {m.get("id"): m for m in materials}

        total_cost = 0
        for region in regions:
            material = material_by_id.get(region.get("materialId"))
            if material:
                total_cost += (material.get("pricePerSqFt") or 0) * (region.get("area") or 0)

        return {
            "id": str(self.id),
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "regions_count": len(regions),
            "materials_count": len(materials),
            "total_cost": round(total_cost, 2),
        }

    def to_full(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "data": self.data,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
