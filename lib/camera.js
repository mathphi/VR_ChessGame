const make_camera = function (
        canvas,
        radius, zenith, azimuth,
        world_up, world_center,
        zenith_min = 1, zenith_max = 179,
        azimuth_min = -360, azimuth_max = 360,
        radius_min = 4.0, radius_max = 100)
{
    let _world_center = glMatrix.vec3.create();
    let _world_up     = glMatrix.vec3.create();
    glMatrix.vec3.copy(_world_center, world_center);
    glMatrix.vec3.copy(_world_up, world_up);

    let _cam_zenith  = zenith;
    let _cam_azimuth = azimuth;
    let _cam_radius  = radius;

    // These vectors will be defined in update_camera_vectors()
    const _cam_position = glMatrix.vec3.create();
    const _cam_right    = glMatrix.vec3.create();
    const _cam_front    = glMatrix.vec3.create();
    const _cam_up       = glMatrix.vec3.create();

    // View and Projection matrices
    const _view = glMatrix.mat4.create();
    const _projection = glMatrix.mat4.create();

    // Movement step angle/distance for keyboard and mouse
    const _key_movement_dist    = 0.15;
    const _key_movement_angle   = 1.5;  // Degrees
    const _mouse_movement_dist  = 0.01;
    const _mouse_movement_angle = 0.5;  // Degrees

    // Mouse movement variables
    let _mouse_prev_x = -1;
    let _mouse_prev_y = -1;

    register_keyboard();
    register_mouse();
    update_camera_vectors();

    function register_keyboard() {
        document.addEventListener('keydown', (event) => {

            let dx = 0, dy = 0, dz = 0;
            let cam_moved = true;
            switch (event.key) {
                case 'ArrowUp':
                    // Decrease zenith angle
                    dy = -_key_movement_angle;
                    break;
                case 'ArrowDown':
                    // Increase zenith angle
                    dy = _key_movement_angle;
                    break;
                case 'ArrowRight':
                    // Increase azimuth angle
                    dx = _key_movement_angle;
                    break;
                case 'ArrowLeft':
                    // Decrease azimuth angle
                    dx = -_key_movement_angle;
                    break;
                case 'Add':
                case '+':
                    // Decrease the radius distance
                    dz = -_key_movement_dist;
                    break;
                case 'Subtract':
                case '-':
                    // Increase the radius distance
                    dz = _key_movement_dist;
                    break;
                default:
                    cam_moved = false;

                    // Ensure the key is in the special orientations list
                    if (event.key in keys_cam_settings) {
                        set_special_orientation(event.key);
                    }
                    break;
            }

            // If a key event resulted in changes in camera view
            if (cam_moved) {
                // Prevent webpage scrolling using arrow keys
                event.preventDefault();

                // Process the computed movements
                process_camera_movement(dx, dy, dz, event.ctrlKey);
            }
        }, false);
    }

    function register_mouse() {
        function get_mouse_pos(canvas, evt) {
            const rect = canvas.getBoundingClientRect();
            return {
                // Mouse coordinates relative to canvas (not screen)
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
        }
        canvas.addEventListener("mousemove", function(event) {
            // Check if the mouse was pressed, else do nothing
            if (!(event.buttons & _mouse_view_button)) {
                _mouse_prev_x = -1;
                _mouse_prev_y = -1;
                return;
            }

            // Get mouse position
            const pos = get_mouse_pos(canvas, event);

            // Mouse coordinates relative to center of canvas
            const x = pos.x - canvas.width / 2;
            const y = pos.y - canvas.height / 2;

            // Condition to avoid weird behavior at the first mouse movement.
            // The previous mouse position is initialized to -1.
            if (_mouse_prev_x !== -1 && _mouse_prev_y !== -1) {
                // Compute mouse displacement
                const dx = _mouse_prev_x - x;
                const dy = _mouse_prev_y - y;

                // This is a center translation if CTRL is pressed
                if (!event.ctrlKey) {
                    // Process according to displacement
                    process_camera_movement(
                        _mouse_movement_angle * dx,
                        _mouse_movement_angle * dy,
                        0.0
                    );
                }
                else {
                    // Do a translation of the camera sphere
                    process_camera_movement(
                        _mouse_movement_angle * dx * -0.05,
                        _mouse_movement_angle * dy * -0.05,
                        0.0,
                        true
                    );
                }
            }

            // Store current position
            _mouse_prev_x = x;
            _mouse_prev_y = y;
        }, false);

        canvas.addEventListener("wheel", function(event) {
            // Prevent webpage scrolling using mouse wheel
            event.preventDefault();

            process_camera_movement(
                0.0,
                0.0,
                _mouse_movement_dist * event.deltaY,
                event.ctrlKey
            );
        }, false);
    }

    function process_camera_movement(dx, dy, dz, center_translate = false) {
        if (!center_translate) {
            // Modify azimuth angle (horizontal movement)
            _cam_azimuth += dx;

            // Modify zenith angle (vertical movement)
            _cam_zenith += dy;

            // Modify camera distance (mouse wheel)
            _cam_radius += dz;
        }
        // If the action is a translation of the camera's sphere
        else {
            glMatrix.vec3.add(
                _world_center,
                _world_center,
                glMatrix.vec3.fromValues(
                    dx * Math.sin(deg2rad(_cam_azimuth)) - dy * Math.cos(deg2rad(_cam_azimuth)),
                    dz,
                    dy * Math.sin(deg2rad(_cam_azimuth)) + dx * Math.cos(deg2rad(_cam_azimuth))
                )
            );
        }

        cancel_orientation_animation();

        // Update camera vectors according to new angles
        update_camera_vectors();
    }

    function get_view_matrix() {
        return _view;
    }

    function set_projection(fov = 45.0, ratio = 1.0, near = 0.01, far = 100.0) {
        glMatrix.mat4.perspective(_projection, deg2rad(fov), ratio, near, far);
        return _projection;
    }

    function get_projection_matrix() {
        return _projection;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180.0);
    }

    function update_camera_vectors() {
        // Bound spherical coordinates
        _cam_zenith  = Math.max(zenith_min,  Math.min(zenith_max,  _cam_zenith % 360));
        _cam_azimuth = Math.max(azimuth_min, Math.min(azimuth_max, _cam_azimuth % 360));
        _cam_radius  = Math.max(radius_min,  Math.min(radius_max,  _cam_radius));

        const zenith_r  = deg2rad(_cam_zenith);
        const azimuth_r = deg2rad(_cam_azimuth);

        // Compute cartesian coordinates from polar
        // WARNING: OpenGL coordinates are Y-axis UP, Z-axis backward!
        const x = _cam_radius * Math.cos(azimuth_r) * Math.sin(zenith_r);
        const y = _cam_radius * Math.cos(zenith_r);
        const z = -_cam_radius * Math.sin(azimuth_r) * Math.sin(zenith_r);

        // Position vector
        glMatrix.vec3.set(_cam_position, x, y, z);
        glMatrix.vec3.add(_cam_position, _cam_position, _world_center);

        // Compute the front normalized vector
        glMatrix.vec3.sub(_cam_front, _world_center, _cam_position);
        glMatrix.vec3.normalize(_cam_front, _cam_front);

        // Compute camera right normalized vector from front and world_up
        glMatrix.vec3.cross(_cam_right, _cam_front, _world_up);
        glMatrix.vec3.normalize(_cam_right, _cam_right);

        // Compute camera up normalized vector as cross product
        // between right and front vectors
        glMatrix.vec3.cross(_cam_up, _cam_right, _cam_front);
        glMatrix.vec3.normalize(_cam_up, _cam_up);

        // Update view matrix
        glMatrix.mat4.lookAt(_view, _cam_position, _world_center, _cam_up);
    }

    function get_position() {
        return _cam_position;
    }

    /**
     * This function computes the ray from a position on the camera view
     * and continuing straight into the scene
     * @param position: Start position of the ray
     * @param view_width: Width of the viewport
     * @param view_height: Height of the viewport
     */
    function get_picking_ray(position, view_width, view_height) {
        const norm_pos = glMatrix.vec2.fromValues(
            (position[0] / view_width - 0.5) * 2.0,
            -(position[1] / view_height - 0.5) * 2.0
        );

        // Compute Normalized Device Coordinates
        const ray_start = glMatrix.vec4.fromValues(norm_pos[0], norm_pos[1], 0.0, 1.0);
        const ray_end   = glMatrix.vec4.fromValues(norm_pos[0], norm_pos[1], 1.0, 1.0);

        // Compute the inverse view and projection
        const tmp_mat = glMatrix.mat4.create();
        glMatrix.mat4.multiply(tmp_mat, _projection, _view);
        glMatrix.mat4.invert(tmp_mat, tmp_mat);

        const ray_start_world = glMatrix.vec4.create();
        const ray_end_world   = glMatrix.vec4.create();
        const ray_start_norm = glMatrix.vec3.create();
        const ray_end_norm   = glMatrix.vec3.create();
        glMatrix.vec4.transformMat4(ray_start_world, ray_start, tmp_mat);
        glMatrix.vec4.transformMat4(ray_end_world, ray_end, tmp_mat);
        glMatrix.vec3.scale(ray_start_norm, ray_start_world, 1.0 / ray_start_world[3]);
        glMatrix.vec3.scale(ray_end_norm, ray_end_world, 1.0 / ray_end_world[3]);

        const ray_dir_world = glMatrix.vec3.create();
        glMatrix.vec3.sub(ray_dir_world, ray_end_norm, ray_start_norm);
        glMatrix.vec3.normalize(ray_dir_world, ray_dir_world);

        return {
            start: ray_start_norm,
            dir: ray_dir_world
        };
    }

    function set_camera_orientation(camera_zenith, camera_azimuth, camera_radius, camera_center){
        _cam_zenith  = camera_zenith;
        _cam_azimuth = camera_azimuth;
        _cam_radius  = camera_radius;
        glMatrix.vec3.copy(_world_center, camera_center);
        update_camera_vectors();
    }

    // Animation ID containers
    let _global_anim_id = 0;
    let _anim_orientation_id = 0;

    function cancel_orientation_animation() {
        _anim_orientation_id = -1;
    }

    function anim_camera_orientation(zenith, azimuth, radius, coord_center, duration) {
        zenith  = zenith  === null ? _cam_zenith  : zenith;
        azimuth = azimuth === null ? _cam_azimuth : azimuth;
        radius  = radius  === null ? _cam_radius  : radius;
        coord_center = coord_center === null ? _world_center : coord_center;

        // Save the current animation ID
        const anim_id = _global_anim_id++;
        _anim_orientation_id = anim_id;

        // Initial time of animation
        const init_t    = performance.now();
        const init_zenith   = _cam_zenith;
        const init_azimuth  = _cam_azimuth;
        const init_radius   = _cam_radius;
        const init_center   = glMatrix.vec3.create();
        glMatrix.vec3.copy(init_center, _world_center);

        // Compute delta of sphere center position
        // delta_pos = new_pos - current_pos
        const delta_pos = glMatrix.vec3.create();
        glMatrix.vec3.sub(delta_pos, coord_center, init_center);

        // Compute delta of cam coordinates in spherical system (avoid making a 360° turn around)
        const delta_zenith  = (zenith - init_zenith + 540.0) % 360 - 180;
        const delta_azimuth = (azimuth - init_azimuth + 540.0) % 360 - 180;
        const delta_radius  = (radius - init_radius + 540.0) % 360 - 180;

        function animate(time) {
            // Exit animation if animation ID changed (only one move anim at a time on the camera)
            if (_anim_orientation_id !== anim_id)
                return;

            const t = Math.max(0, time - init_t);
            const t_f = t / duration;
            const scale = (1 - Math.cos(Math.PI * t_f)) / 2.0;

            // Compute the current center position at this time
            const current_center = glMatrix.vec3.create();
            glMatrix.vec3.scale(current_center, delta_pos, scale);
            glMatrix.vec3.add(current_center, current_center, init_center);

            // Set camera orientation
            set_camera_orientation(
                init_zenith + delta_zenith * scale,
                init_azimuth + delta_azimuth * scale,
                init_radius + delta_radius * scale,
                current_center
            );

            if (t < duration) {
                window.requestAnimationFrame(animate);
            }
            else {
                set_camera_orientation(zenith, azimuth, radius, coord_center);
            }
        }

        if (duration >= 0.0) {
            animate(0);
        }
        else {
            set_camera_orientation(zenith, azimuth, radius, coord_center);
        }
    }

    function set_key_camera_view(key, cam_zen, cam_az, cam_rad, center) {
        keys_cam_settings[key].zenith  = cam_zen;
        keys_cam_settings[key].azimuth = cam_az;
        keys_cam_settings[key].radius  = cam_rad;
        keys_cam_settings[key].center  = center;
    }

    function set_special_orientation(orient_id, anim_duration = 500.0) {
        if (orient_id in keys_cam_settings) {
            anim_camera_orientation(
                keys_cam_settings[orient_id].zenith,
                keys_cam_settings[orient_id].azimuth,
                keys_cam_settings[orient_id].radius,
                keys_cam_settings[orient_id].center,
                anim_duration
            );
        }
    }

    const keys_cam_settings = {
        0: {zenith: 60.0, azimuth: 240.0, radius: 55, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},    // 0
        1: {zenith: 45.0, azimuth: 135.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},  // 1
        2: {zenith: 45.0, azimuth: 180.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},  // 2
        3: {zenith: 45.0, azimuth: 225.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},  // 3
        4: {zenith: 45.0, azimuth: 90.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},   // 4
        5: {zenith: 0.0, azimuth: 0.0, radius: 16.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},     // 5
        6: {zenith: 45.0, azimuth: 270.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},  // 6
        7: {zenith: 45.0, azimuth: 45.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},   // 7
        8: {zenith: 45.0, azimuth: 0.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},    // 8
        9: {zenith: 45.0, azimuth: 315.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)},  // 9
        [' ']: {zenith: 0.0, azimuth: 0.0, radius: 16.0, center: glMatrix.vec3.fromValues(0.0, 0.0, 0.0)}
    };


    return {
        get_view_matrix: get_view_matrix,
        set_projection: set_projection,
        get_projection_matrix: get_projection_matrix,
        get_position: get_position,
        get_picking_ray: get_picking_ray,
        set_key_camera_view: set_key_camera_view,
        set_special_orientation: set_special_orientation,
        anim_camera_orientation: anim_camera_orientation,
    }
};
