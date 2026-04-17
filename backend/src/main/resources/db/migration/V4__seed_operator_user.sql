INSERT INTO users (id, username, email, password_hash, name, is_active)
VALUES (
           '00000000-0000-0000-0000-000000000002',
           'operator',
           'operator@example.com',
           '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzGaeFvts6MVqcTpLkG',
           'Operator',
           TRUE
       );

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM roles
WHERE name = 'OPERATOR';
