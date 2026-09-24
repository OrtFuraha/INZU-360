const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

/**
 * Convert stored tour paths into browser-accessible URLs.
 */
function normalizeTourUrl(url, defaultFolder) {
    if (!url) return null;

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    if (url.startsWith('/storage/') || url.startsWith('/uploads/')) {
        return url;
    }

    if (url.startsWith('/')) {
        return url;
    }

    if (url.startsWith('storage/')) {
        return '/' + url;
    }

    return `/storage/tours/${defaultFolder}/${url}`;
}

/**
 * Render 3D tour player.
 */
router.get('/tour/:tourId', (req, res) => {
    const db = getDB();
    const tourId = req.params.tourId;

    try {
        const tour = db.prepare(`
            SELECT
                vt.*,
                p.title AS property_title,
                p.id AS property_id
            FROM virtual_tours vt
            JOIN properties p ON vt.property_id = p.id
            WHERE vt.id = ?
        `).get(tourId);

        if (!tour) {
            return res.status(404).render('pages/404', {
                title: 'Tour Not Found'
            });
        }

        const scenes = db.prepare(`
            SELECT *
            FROM tour_scenes
            WHERE tour_id = ?
            ORDER BY order_index ASC, id ASC
        `).all(tourId);

        scenes.forEach(scene => {
            scene.panorama_url = normalizeTourUrl(
                scene.panorama_url,
                'panoramas'
            );

            scene.thumbnail_url = normalizeTourUrl(
                scene.thumbnail_url,
                'panoramas'
            );

            scene.hotspots = db.prepare(`
                SELECT
                    h.*,
                    ts.name AS target_scene_name
                FROM tour_hotspots h
                LEFT JOIN tour_scenes ts
                    ON h.target_scene_id = ts.id
                WHERE h.scene_id = ?
                ORDER BY h.id ASC
            `).all(scene.id);
        });

        const floorPlans = db.prepare(`
            SELECT *
            FROM tour_floor_plans
            WHERE tour_id = ?
            ORDER BY floor_number ASC, id ASC
        `).all(tourId);

        floorPlans.forEach(plan => {
            plan.image_url = normalizeTourUrl(
                plan.image_url,
                'floorplans'
            );
        });

        const modelUrl = normalizeTourUrl(
            tour.model_url,
            'models'
        );

        res.render('pages/virtual-tour/player3d', {
            title: `${tour.property_title} - 3D Tour`,
            tour,
            scenes,
            floorPlans,
            modelExists: Boolean(modelUrl),
            modelUrl,
            propertyId: tour.property_id,
            propertyTitle: tour.property_title,
            tourId: tour.id
        });

    } catch (err) {
        console.error('Error loading 3D tour:', err);

        res.status(500).render('pages/500', {
            title: 'Server Error'
        });
    }
});

/**
 * Return tour data to the browser.
 */
router.get('/api/tour/:tourId/data', (req, res) => {
    const db = getDB();
    const tourId = req.params.tourId;

    try {
        const tour = db.prepare(`
            SELECT
                vt.*,
                p.title AS property_title
            FROM virtual_tours vt
            JOIN properties p
                ON vt.property_id = p.id
            WHERE vt.id = ?
        `).get(tourId);

        if (!tour) {
            return res.status(404).json({
                error: 'Tour not found'
            });
        }

        const scenes = db.prepare(`
            SELECT *
            FROM tour_scenes
            WHERE tour_id = ?
            ORDER BY order_index ASC, id ASC
        `).all(tourId);

        scenes.forEach(scene => {
            scene.panorama_url = normalizeTourUrl(
                scene.panorama_url,
                'panoramas'
            );

            scene.thumbnail_url = normalizeTourUrl(
                scene.thumbnail_url,
                'panoramas'
            );

            scene.hotspots = db.prepare(`
                SELECT
                    h.*,
                    ts.name AS target_scene_name
                FROM tour_hotspots h
                LEFT JOIN tour_scenes ts
                    ON h.target_scene_id = ts.id
                WHERE h.scene_id = ?
                ORDER BY h.id ASC
            `).all(scene.id);
        });

        const floorPlans = db.prepare(`
            SELECT *
            FROM tour_floor_plans
            WHERE tour_id = ?
            ORDER BY floor_number ASC, id ASC
        `).all(tourId);

        floorPlans.forEach(plan => {
            plan.image_url = normalizeTourUrl(
                plan.image_url,
                'floorplans'
            );
        });

        res.json({
            tour,
            scenes,
            floorPlans,
            propertyTitle: tour.property_title,
            modelUrl: normalizeTourUrl(
                tour.model_url,
                'models'
            )
        });

    } catch (err) {
        console.error('Error fetching tour data:', err);

        res.status(500).json({
            error: 'Failed to load tour data'
        });
    }
});

/**
 * Track a tour view.
 */
router.post('/api/tour/:tourId/view', (req, res) => {
    const db = getDB();
    const tourId = req.params.tourId;

    const sessionId = req.body?.sessionId || null;
    const userId = req.session?.user?.id || null;

    try {
        db.prepare(`
            UPDATE virtual_tours
            SET views = COALESCE(views, 0) + 1
            WHERE id = ?
        `).run(tourId);

        db.prepare(`
            INSERT INTO tour_views (
                tour_id,
                user_id,
                session_id
            )
            VALUES (?, ?, ?)
        `).run(
            tourId,
            userId,
            sessionId
        );

        res.json({
            success: true
        });

    } catch (err) {
        console.error('Error tracking tour view:', err);

        res.json({
            success: true
        });
    }
});

/**
 * Track a scene view.
 */
router.post('/api/tour/scene/:sceneId/view', (req, res) => {
    const db = getDB();
    const sceneId = req.params.sceneId;

    const tourViewId = req.body?.tourViewId || null;
    const duration = Number(req.body?.duration || 0);

    try {
        db.prepare(`
            INSERT INTO tour_scene_views (
                scene_id,
                tour_view_id,
                duration
            )
            VALUES (?, ?, ?)
        `).run(
            sceneId,
            tourViewId,
            duration
        );

        res.json({
            success: true
        });

    } catch (err) {
        console.error('Error tracking scene view:', err);

        res.json({
            success: true
        });
    }
});

/**
 * Track a hotspot click.
 */
router.post('/api/tour/hotspot/:hotspotId/click', (req, res) => {
    const db = getDB();
    const hotspotId = req.params.hotspotId;

    const sceneId = req.body?.sceneId;

    try {
        if (!sceneId) {
            return res.status(400).json({
                success: false,
                error: 'sceneId is required'
            });
        }

        db.prepare(`
            INSERT INTO tour_hotspot_clicks (
                hotspot_id,
                scene_id
            )
            VALUES (?, ?)
        `).run(
            hotspotId,
            sceneId
        );

        res.json({
            success: true
        });

    } catch (err) {
        console.error('Error tracking hotspot click:', err);

        res.json({
            success: true
        });
    }
});

module.exports = router;
