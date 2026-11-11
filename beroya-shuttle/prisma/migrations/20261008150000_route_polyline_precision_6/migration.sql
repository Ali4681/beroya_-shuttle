-- Bump default polyline precision for denser road geometry at high zoom
ALTER TABLE "ShuttleRoute" ALTER COLUMN "polylinePrecision" SET DEFAULT 6;
