-- Performance Indices for Multi-Tenant Queries

CREATE INDEX idx_services_business_id ON services(business_id);
CREATE INDEX idx_schedules_business_id ON schedules(business_id);
CREATE INDEX idx_professionals_business_id ON professionals(business_id);
CREATE INDEX idx_patients_business_id ON patients(business_id);
CREATE INDEX idx_patients_rut ON patients(rut);
CREATE INDEX idx_bookings_business_id ON bookings(business_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_patient_rut ON bookings(patient_rut);
CREATE INDEX idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX idx_consultations_business_id ON consultations(business_id);
CREATE INDEX idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX idx_consultations_professional_id ON consultations(professional_id);
CREATE INDEX idx_prescriptions_business_id ON prescriptions(business_id);
CREATE INDEX idx_prescriptions_consultation_id ON prescriptions(consultation_id);
CREATE INDEX idx_billing_customers_business_id ON billing_customers(business_id);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_password_resets_business_id ON password_resets(business_id);
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
