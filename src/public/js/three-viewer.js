(function () {
    'use strict';

    let scene;
    let camera;
    let renderer;
    let sphere;
    let controls;
    let raycaster;
    let mouse;

    let tourData = null;
    let currentScene = null;
    let hotspotObjects = [];

    const viewer = document.getElementById('tour-viewer');
    const loading = document.getElementById('tour-loading');
    const sceneTitle = document.getElementById('scene-title');
    const sceneDescription = document.getElementById('scene-description');
    const thumbnailBar = document.getElementById('scene-thumbnails');
    const hotspotLayer = document.getElementById('hotspot-layer');

    function log() {
        console.log('[INZU360 3D]', ...arguments);
    }

    function showLoading(show) {
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }

    function init() {
        if (!viewer) {
            console.error('INZU360 viewer element not found.');
            return;
        }

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            75,
            viewer.clientWidth / viewer.clientHeight,
            0.1,
            1100
        );

        camera.position.set(0, 0, 0.1);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(viewer.clientWidth, viewer.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        viewer.appendChild(renderer.domElement);

        /*
         * Simple vanilla-JS touch/mouse controls.
         * No React, no JSX, no external UI framework.
         */
        controls = {
            yaw: 0,
            pitch: 0,
            dragging: false,
            lastX: 0,
            lastY: 0
        };

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, {
            passive: false
        });

        window.addEventListener('resize', onResize);

        setupButtons();

        loadTourData();

        animate();
    }

    function setupButtons() {
        const fullscreenButton = document.getElementById('fullscreen-btn');
        const resetButton = document.getElementById('reset-view-btn');

        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', toggleFullscreen);
        }

        if (resetButton) {
            resetButton.addEventListener('click', resetView);
        }
    }

    async function loadTourData() {
        try {
            showLoading(true);

            const tourId = viewer.dataset.tourId;

            const response = await fetch(
                '/3d/api/tour/' + encodeURIComponent(tourId) + '/data'
            );

            if (!response.ok) {
                throw new Error('Tour API returned HTTP ' + response.status);
            }

            tourData = await response.json();

            log('Tour loaded:', tourData);

            renderThumbnails();

            if (tourData.scenes && tourData.scenes.length > 0) {
                loadScene(tourData.scenes[0].id);
            } else {
                showError('No scenes have been added to this tour yet.');
            }
        } catch (error) {
            console.error(error);
            showError('Unable to load the virtual tour.');
        }
    }

    function renderThumbnails() {
        if (!thumbnailBar || !tourData || !tourData.scenes) {
            return;
        }

        thumbnailBar.innerHTML = '';

        tourData.scenes.forEach(function (tourScene) {
            const button = document.createElement('button');
            button.className = 'scene-thumbnail';
            button.dataset.sceneId = tourScene.id;

            const image = document.createElement('img');

            image.src =
                tourScene.thumbnail_url ||
                tourScene.panorama_url ||
                '/storage/tours/panoramas/demo-panorama.svg';

            image.alt = tourScene.name || 'Room';

            const label = document.createElement('span');
            label.textContent = tourScene.name || 'Room';

            button.appendChild(image);
            button.appendChild(label);

            button.addEventListener('click', function () {
                loadScene(tourScene.id);
            });

            thumbnailBar.appendChild(button);
        });
    }

    function loadScene(sceneId) {
        if (!tourData || !tourData.scenes) {
            return;
        }

        const nextScene = tourData.scenes.find(function (item) {
            return Number(item.id) === Number(sceneId);
        });

        if (!nextScene) {
            console.warn('Scene not found:', sceneId);
            return;
        }

        currentScene = nextScene;

        const panoramaUrl =
            nextScene.panorama_url ||
            '/storage/tours/panoramas/demo-panorama.svg';

        showLoading(true);

        const loader = new THREE.TextureLoader();

        loader.load(
            panoramaUrl,
            function (texture) {
                texture.colorSpace = THREE.SRGBColorSpace;

                if (sphere) {
                    scene.remove(sphere);

                    if (sphere.geometry) {
                        sphere.geometry.dispose();
                    }

                    if (sphere.material) {
                        sphere.material.dispose();
                    }
                }

                const geometry = new THREE.SphereGeometry(
                    100,
                    64,
                    40
                );

                geometry.scale(-1, 1, 1);

                const material = new THREE.MeshBasicMaterial({
                    map: texture
                });

                sphere = new THREE.Mesh(geometry, material);
                scene.add(sphere);

                controls.yaw =
                    THREE.MathUtils.degToRad(
                        Number(nextScene.initial_yaw || 0)
                    );

                controls.pitch =
                    THREE.MathUtils.degToRad(
                        Number(nextScene.initial_pitch || 0)
                    );

                camera.fov =
                    Number(nextScene.initial_fov || 75);

                camera.updateProjectionMatrix();

                updateSceneInformation();
                renderHotspots();

                document
                    .querySelectorAll('.scene-thumbnail')
                    .forEach(function (element) {
                        element.classList.toggle(
                            'active',
                            Number(element.dataset.sceneId) ===
                                Number(nextScene.id)
                        );
                    });

                showLoading(false);

                log('Loaded scene:', nextScene.name);
            },
            undefined,
            function (error) {
                console.error(
                    'Could not load panorama:',
                    panoramaUrl,
                    error
                );

                showLoading(false);
                showError(
                    'Panorama could not be loaded: ' +
                    panoramaUrl
                );
            }
        );
    }

    function updateSceneInformation() {
        if (sceneTitle) {
            sceneTitle.textContent =
                currentScene.name || 'Virtual Tour';
        }

        if (sceneDescription) {
            sceneDescription.textContent =
                currentScene.description ||
                'Explore this property in 360°.';
        }
    }

    function renderHotspots() {
        if (!hotspotLayer) {
            return;
        }

        hotspotLayer.innerHTML = '';

        hotspotObjects = [];

        const hotspots = currentScene.hotspots || [];

        hotspots.forEach(function (hotspot) {
            const element = document.createElement('button');

            element.className = 'tour-hotspot';
            element.type = 'button';

            element.innerHTML =
                '<span class="hotspot-icon">+</span>' +
                '<span class="hotspot-label">' +
                escapeHtml(
                    hotspot.title ||
                    hotspot.target_scene_name ||
                    'Explore'
                ) +
                '</span>';

            element.addEventListener('click', function (event) {
                event.stopPropagation();

                if (hotspot.target_scene_id) {
                    loadScene(hotspot.target_scene_id);
                } else {
                    alert(
                        hotspot.description ||
                        hotspot.title ||
                        'Information hotspot'
                    );
                }
            });

            hotspotLayer.appendChild(element);

            hotspotObjects.push({
                element: element,
                yaw: Number(hotspot.yaw || 0),
                pitch: Number(hotspot.pitch || 0)
            });
        });
    }

    function updateHotspotPositions() {
        if (!hotspotLayer || !currentScene) {
            return;
        }

        hotspotObjects.forEach(function (item) {
            const yaw = THREE.MathUtils.degToRad(item.yaw);
            const pitch = THREE.MathUtils.degToRad(item.pitch);

            const direction = new THREE.Vector3(
                Math.sin(yaw) * Math.cos(pitch),
                Math.sin(pitch),
                -Math.cos(yaw) * Math.cos(pitch)
            );

            const distance = 10;

            const point = direction
                .multiplyScalar(distance)
                .add(camera.position);

            point.project(camera);

            const visible =
                point.z < 1 &&
                point.z > -1 &&
                Math.abs(point.x) < 1.1 &&
                Math.abs(point.y) < 1.1;

            item.element.style.display =
                visible ? 'flex' : 'none';

            if (visible) {
                const x =
                    (point.x * 0.5 + 0.5) *
                    viewer.clientWidth;

                const y =
                    (-point.y * 0.5 + 0.5) *
                    viewer.clientHeight;

                item.element.style.left = x + 'px';
                item.element.style.top = y + 'px';
            }
        });
    }

    function onPointerDown(event) {
        controls.dragging = true;
        controls.lastX = event.clientX;
        controls.lastY = event.clientY;

        renderer.domElement.setPointerCapture(
            event.pointerId
        );
    }

    function onPointerMove(event) {
        if (!controls.dragging) {
            return;
        }

        const dx = event.clientX - controls.lastX;
        const dy = event.clientY - controls.lastY;

        controls.lastX = event.clientX;
        controls.lastY = event.clientY;

        controls.yaw -= dx * 0.004;
        controls.pitch -= dy * 0.004;

        const limit = Math.PI / 2 - 0.05;

        controls.pitch = THREE.MathUtils.clamp(
            controls.pitch,
            -limit,
            limit
        );
    }

    function onPointerUp() {
        controls.dragging = false;
    }

    function onWheel(event) {
        event.preventDefault();

        camera.fov += event.deltaY * 0.04;

        camera.fov = THREE.MathUtils.clamp(
            camera.fov,
            35,
            90
        );

        camera.updateProjectionMatrix();
    }

    function resetView() {
        controls.yaw = 0;
        controls.pitch = 0;

        camera.fov = 75;
        camera.updateProjectionMatrix();
    }

    function toggleFullscreen() {
        const container =
            document.getElementById('tour-container');

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(function (error) {
                console.error(
                    'Fullscreen failed:',
                    error
                );
            });
        } else {
            document.exitFullscreen();
        }
    }

    function onResize() {
        if (!renderer || !camera || !viewer) {
            return;
        }

        const width = viewer.clientWidth;
        const height = viewer.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    }

    function animate() {
        requestAnimationFrame(animate);

        if (!camera || !renderer) {
            return;
        }

        camera.rotation.order = 'YXZ';

        camera.rotation.y = controls.yaw;
        camera.rotation.x = controls.pitch;

        renderer.render(scene, camera);

        updateHotspotPositions();
    }

    function showError(message) {
        if (!loading) {
            return;
        }

        loading.classList.remove('hidden');
        loading.innerHTML =
            '<div class="tour-error">' +
            escapeHtml(message) +
            '</div>';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /*
     * Import Three.js from the npm package through a browser CDN.
     * This keeps the application vanilla JavaScript.
     */
    const script = document.createElement('script');

    script.type = 'importmap';

    script.textContent = JSON.stringify({
        imports: {
            three: 'https://unpkg.com/three@0.185.1/build/three.module.js'
        }
    });

    document.head.appendChild(script);

    /*
     * The viewer is loaded by player3d.ejs using a module.
     */
    window.INZU360Viewer = {
        init: init
    };
})();
