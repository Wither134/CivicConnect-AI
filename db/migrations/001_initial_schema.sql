-- CivicFix Core Database Schema
-- Migration: 001_initial_schema.sql

CREATE TYPE user_role AS ENUM ('citizen', 'staff', 'admin', 'super_admin');
CREATE TYPE user_status AS ENUM ('active', 'invited', 'deactivated');
CREATE TYPE report_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE report_status AS ENUM (
    'submitted',
    'under_review',
    'verified',
    'assigned',
    'in_progress',
    'work_completed',
    'resolved',
    'rejected',
    'duplicate',
    'reopened'
);

-- Departments table
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_id VARCHAR(36) REFERENCES departments(id),
    icon VARCHAR(50) NOT NULL,
    default_priority report_priority DEFAULT 'medium',
    sla_response_hours INT NOT NULL DEFAULT 72,
    sla_resolve_hours INT NOT NULL DEFAULT 168,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'citizen',
    department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(64),
    status user_status NOT NULL DEFAULT 'active',
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SLA Policies table
CREATE TABLE sla_policies (
    id VARCHAR(36) PRIMARY KEY,
    priority report_priority NOT NULL UNIQUE,
    response_hours INT NOT NULL,
    resolution_hours INT NOT NULL,
    description VARCHAR(255)
);

-- Reports table
CREATE TABLE reports (
    id VARCHAR(36) PRIMARY KEY,
    reference_number VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id VARCHAR(36) REFERENCES categories(id) NOT NULL,
    priority report_priority NOT NULL DEFAULT 'medium',
    priority_score INT NOT NULL DEFAULT 50,
    status report_status NOT NULL DEFAULT 'submitted',
    version INT NOT NULL DEFAULT 1,
    reporter_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    assignee_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    reviewer_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
    lock_owner_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    exact_lat NUMERIC(9,6),
    exact_lng NUMERIC(9,6),
    coarsened_lat NUMERIC(6,3),
    coarsened_lng NUMERIC(6,3),
    ward VARCHAR(50),
    address_hint VARCHAR(255),
    response_due_at TIMESTAMP WITH TIME ZONE,
    resolution_due_at TIMESTAMP WITH TIME ZONE,
    first_responded_at TIMESTAMP WITH TIME ZONE,
    work_completed_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    reopen_reason TEXT,
    parent_report_id VARCHAR(36) REFERENCES reports(id) ON DELETE SET NULL,
    is_spam BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    delete_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Report Images table (EXIF stripped)
CREATE TABLE report_images (
    id VARCHAR(36) PRIMARY KEY,
    report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size_bytes INT NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    exif_stripped BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_role user_role NOT NULL,
    is_proof BOOLEAN NOT NULL DEFAULT FALSE,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Status History (Append-only)
CREATE TABLE status_history (
    id VARCHAR(36) PRIMARY KEY,
    report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    from_status report_status NOT NULL,
    to_status report_status NOT NULL,
    note TEXT NOT NULL,
    proof_image_id VARCHAR(36) REFERENCES report_images(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Duplicate Links (with 24-hour undo window)
CREATE TABLE duplicate_links (
    id VARCHAR(36) PRIMARY KEY,
    duplicate_report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
    parent_report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
    similarity_score NUMERIC(5,2) NOT NULL,
    merged_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    merged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    undo_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_undone BOOLEAN NOT NULL DEFAULT FALSE,
    undone_at TIMESTAMP WITH TIME ZONE,
    undone_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    undo_reason TEXT
);

-- Audit Logs (Append-only)
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role user_role,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    details_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    report_id VARCHAR(36) REFERENCES reports(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Feature flags
CREATE TABLE feature_flags (
    name VARCHAR(50) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT
);

-- Indices
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_assignee ON reports(assignee_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_category ON reports(category_id);
CREATE INDEX idx_reports_priority ON reports(priority);
CREATE INDEX idx_reports_resolution_due ON reports(resolution_due_at);
CREATE INDEX idx_status_history_report ON status_history(report_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

