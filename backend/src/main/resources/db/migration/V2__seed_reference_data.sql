-- Reference roles, default admin user (password: "password"), global data policy.
-- Change password immediately in any shared environment.

INSERT INTO roles (name, description)
VALUES ('OPERATOR', 'Monitoring and alarms'),
       ('ADMIN', 'Full configuration access');

-- BCrypt hash for literal password: password (Spring Security compatible)
INSERT INTO users (id, username, email, password_hash, name, is_active)
VALUES (
           '00000000-0000-0000-0000-000000000001',
           'admin',
           'admin@example.com',
           '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzGaeFvts6MVqcTpLkG',
           'Administrator',
           TRUE
       );

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM roles
WHERE name = 'ADMIN';

INSERT INTO system_data_policy (id, raw_retention_days, aggregate_retention_days, downsampling_interval, updated_at)
VALUES (1, 7, 365, '10m', now());
