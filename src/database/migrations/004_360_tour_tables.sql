-- INZU360 360° Virtual Tour Tables
-- Safe/idempotent: does not modify existing tables or delete data.

CREATE TABLE IF NOT EXISTS tour_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    panorama_url TEXT,
    thumbnail_url TEXT,
    order_index INTEGER DEFAULT 0,
    initial_yaw REAL DEFAULT 0,
    initial_pitch REAL DEFAULT 0,
    initial_fov REAL DEFAULT 75,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES virtual_tours(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tour_hotspots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id INTEGER NOT NULL,
    target_scene_id INTEGER,
    type TEXT DEFAULT 'information',
    title TEXT,
    description TEXT,
    yaw REAL DEFAULT 0,
    pitch REAL DEFAULT 0,
    icon TEXT DEFAULT 'info',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES tour_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_scene_id) REFERENCES tour_scenes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tour_floor_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    floor_number INTEGER DEFAULT 0,
    name TEXT DEFAULT 'Floor Plan',
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES virtual_tours(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tour_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL,
    user_id INTEGER,
    session_id TEXT,
    view_duration INTEGER DEFAULT 0,
    interactions INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tour_id) REFERENCES virtual_tours(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tour_scene_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id INTEGER NOT NULL,
    tour_view_id INTEGER,
    duration INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES tour_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (tour_view_id) REFERENCES tour_views(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tour_hotspot_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotspot_id INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotspot_id) REFERENCES tour_hotspots(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES tour_scenes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tour_scenes_tour_id
ON tour_scenes(tour_id);

CREATE INDEX IF NOT EXISTS idx_tour_hotspots_scene_id
ON tour_hotspots(scene_id);

CREATE INDEX IF NOT EXISTS idx_tour_floor_plans_tour_id
ON tour_floor_plans(tour_id);

CREATE INDEX IF NOT EXISTS idx_tour_views_tour_id
ON tour_views(tour_id);

CREATE INDEX IF NOT EXISTS idx_tour_scene_views_scene_id
ON tour_scene_views(scene_id);

CREATE INDEX IF NOT EXISTS idx_tour_hotspot_clicks_hotspot_id
ON tour_hotspot_clicks(hotspot_id);
