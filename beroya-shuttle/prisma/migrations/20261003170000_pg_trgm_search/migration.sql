-- Phase 13: trigram indexes for ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "SchoolStudent_fullName_trgm_idx"
  ON "SchoolStudent" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ShuttleUser_fullName_trgm_idx"
  ON "ShuttleUser" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ShuttleUser_phone_trgm_idx"
  ON "ShuttleUser" USING GIN ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ShuttleRoute_name_trgm_idx"
  ON "ShuttleRoute" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ShuttleVehicle_plateNumber_trgm_idx"
  ON "ShuttleVehicle" USING GIN ("plateNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Institution_name_trgm_idx"
  ON "Institution" USING GIN ("name" gin_trgm_ops);
