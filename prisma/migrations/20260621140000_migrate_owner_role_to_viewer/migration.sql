-- Deprecate owner role: map existing rows to viewer (read-only successor).
UPDATE users SET role = 'viewer' WHERE role = 'owner';
