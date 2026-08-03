"""PostgreSQL schema migration - baseline schema"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260511_0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create baseline schema"""
    
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('roles', sa.JSON(), nullable=True, server_default='["user"]'),
        sa.Column('scopes', sa.JSON(), nullable=True, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Sessions table (for token blacklisting if needed)
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'])
    op.create_index(op.f('ix_sessions_expires_at'), 'sessions', ['expires_at'])
    
    # Audit log table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.String(length=64), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('request_id', sa.String(length=64), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'])
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'])
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'])
    
    # Datasets table
    op.create_table(
        'datasets',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('dataset_type', sa.String(length=50), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=True),  # SHA-256
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_datasets_source'), 'datasets', ['source'])
    op.create_index(op.f('ix_datasets_created_at'), 'datasets', ['created_at'])
    op.create_index(op.f('ix_datasets_content_hash'), 'datasets', ['content_hash'])
    
    # Reports table
    op.create_table(
        'reports',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=False),
        sa.Column('report_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='Draft'),
        sa.Column('risk_score', sa.Integer(), nullable=True),
        sa.Column('risk_band', sa.String(length=20), nullable=True),
        sa.Column('user_id', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index(op.f('ix_reports_region'), 'reports', ['region'])
    op.create_index(op.f('ix_reports_status'), 'reports', ['status'])
    op.create_index(op.f('ix_reports_created_at'), 'reports', ['created_at'])
    

def downgrade() -> None:
    """Drop all tables"""
    op.drop_table('audit_logs')
    op.drop_table('reports')
    op.drop_table('sessions')
    op.drop_table('datasets')
    op.drop_table('users')
