from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    component_name = Column(String, default="Unknown Component")
    image_filename = Column(String)
    defect_found = Column(String)
    defect_type = Column(String)
    severity = Column(String)
    location = Column(Text)
    confidence = Column(Float)
    recommendation = Column(Text)
    compliance_status = Column(String)
    raw_response = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
