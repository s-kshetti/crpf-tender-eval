# backend/models/models.py

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class VerdictEnum(str, enum.Enum):
    ELIGIBLE = 'ELIGIBLE'
    NOT_ELIGIBLE = 'NOT_ELIGIBLE'
    MANUAL_REVIEW = 'MANUAL_REVIEW'

class EvaluationRun(Base):
    __tablename__ = 'evaluation_runs'
    id = Column(String, primary_key=True)  # UUID
    tender_id = Column(String, nullable=False)
    officer_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default='pending')
    criteria = relationship('Criterion', back_populates='run')
    bidder_evals = relationship('BidderEvaluation', back_populates='run')

class Criterion(Base):
    __tablename__ = 'criteria'
    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey('evaluation_runs.id'))
    type = Column(String)  # financial/technical/compliance/certification
    mandatory = Column(Boolean, default=True)
    description = Column(Text)
    threshold = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    proof_required = Column(String)
    raw_text = Column(Text)
    run = relationship('EvaluationRun', back_populates='criteria')

class BidderEvaluation(Base):
    __tablename__ = 'bidder_evaluations'
    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey('evaluation_runs.id'))
    bidder_name = Column(String)
    overall_verdict = Column(String)
    run = relationship('EvaluationRun', back_populates='bidder_evals')
    results = relationship('CriterionResult', back_populates='eval')

class CriterionResult(Base):
    __tablename__ = 'criterion_results'
    id = Column(String, primary_key=True)
    eval_id = Column(String, ForeignKey('bidder_evaluations.id'))
    criterion_id = Column(String)
    source_document = Column(String)
    page_number = Column(Integer, nullable=True)
    extracted_value = Column(String, nullable=True)
    confidence = Column(Float)
    verdict = Column(String)  # ELIGIBLE/NOT_ELIGIBLE/MANUAL_REVIEW
    reason = Column(Text)
    human_override = Column(String, nullable=True)
    override_reason = Column(Text, nullable=True)
    eval = relationship('BidderEvaluation', back_populates='results')

class AuditLog(Base):  # APPEND-ONLY - never update, only insert
    __tablename__ = 'audit_log'
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    run_id = Column(String)
    event_type = Column(String)  # UPLOAD/OCR/EXTRACT/VERDICT/OVERRIDE/EXPORT
    actor = Column(String)  # 'SYSTEM' or officer_id
    details = Column(JSON)  # full context of the event
