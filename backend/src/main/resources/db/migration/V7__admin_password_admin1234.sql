-- Admin seed password: admin1234!!  (BCrypt, strength 10)
UPDATE users
SET password_hash = '$2b$10$dEmkU19uZcseci3qWz2zg.AjFC2Ue7huNjIAXPXH9vFP/TwsZLKoS',
    updated_at    = now()
WHERE username = 'admin';
