-- Align seed hashes with Spring BCryptPasswordEncoder for literal password "password" (see V2 comment).
-- Prior hashes did not verify under Spring Security 6 / BCrypt 0.4+.

UPDATE users
SET password_hash = '$2b$10$/AWMGwYOtxZDOVi/MufBOeXvqyyafYllHtxf7p6fIZELy78nZJOxq',
    updated_at    = now()
WHERE username IN ('admin', 'operator');
