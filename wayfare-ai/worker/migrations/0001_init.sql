CREATE TABLE IF NOT EXISTS shared_itineraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  itinerary_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_itineraries_slug ON shared_itineraries (slug);
CREATE INDEX IF NOT EXISTS idx_shared_itineraries_created_at ON shared_itineraries (created_at);

