const make_camera = function (
        canvas,
        radius, zenith, azimuth,
        world_up, world_center,
        zenith_min = 1, zenith_max = 179,
        azimuth_min = -360, azimuth_max = 360,
        radius_min = 2.0, radius_max = 100)
{
    const MouseButtons = {
        NONE:   0,
        LEFT:   1,
        RIGHT:  2,
        MIDDLE: 4
    }

    let cam_zenith  = zenith;
    let cam_azimuth = azimuth;
    let cam_radius  = radius;

    // These vectors will be defined in update_camera_vectors()
    const cam_position  = glMatrix.vec3.create();
    const cam_right     = glMatrix.vec3.create();
    const cam_front     = glMatrix.vec3.create();
    const cam_up        = glMatrix.vec3.create();

    // View matrix
    const View = glMatrix.mat4.create();

    // Movement step angle/distance for keyboard and mouse
    const key_movement_dist     = 0.15;
    const key_movement_angle    = 1.5;  // Degrees
    const mouse_movement_dist   = 0.01;
    const mouse_movement_angle  = 0.5;  // Degrees

    // Mouse movement variables
    let mouse_prev_x = -1;
    let mouse_prev_y = -1;

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
                    dy = -key_movement_angle;
                    break;
                case 'ArrowDown':
                    // Increase zenith angle
                    dy = key_movement_angle;
                    break;
                case 'ArrowRight':
                    // Increase azimuth angle
                    dx = key_movement_angle;
                    break;
                case 'ArrowLeft':
                    // Decrease azimuth angle
                    dx = -key_movement_angle;
                    break;
                case 'Add':
                case '+':
                    // Decrease the radius distance
                    dz = -key_movement_dist;
                    break;
                case 'Subtract':
                case '-':
                    // Increase the radius distance
                    dz = key_movement_dist;
                    break;
                default:
                    cam_moved = false;
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
            if (!(event.buttons & MouseButtons.LEFT)) {
                mouse_prev_x = -1;
                mouse_prev_y = -1;
                return;
            }

            // Get mouse position
            const pos = get_mouse_pos(canvas, event);

            // Mouse coordinates relative to center of canvas
            const x = pos.x - canvas.width / 2;
            const y = pos.y - canvas.height / 2;

            // Condition to avoid weird behavior at the first mouse movement.
            // The previous mouse position is initialized to -1.
            if (mouse_prev_x !== -1 && mouse_prev_y !== -1) {
                // Compute mouse displacement
                const dx = mouse_prev_x - x;
                const dy = mouse_prev_y - y;

                // This is a center translation if CTRL is pressed
                if (!event.ctrlKey) {
                    // Process according to displacement
                    process_camera_movement(
                        mouse_movement_angle * dx,
                        mouse_movement_angle * dy,
                        0.0
                    );
                }
                else {
                    // Do a translation of the camera sphere
                    process_camera_movement(
                        mouse_movement_angle * dx * -0.05,
                        mouse_movement_angle * dy * -0.05,
                        0.0,
                        true
                    );
                }
            }

            // Store current position
            mouse_prev_x = x;
            mouse_prev_y = y;
        }, false);

        canvas.addEventListener("wheel", function(event) {
            // Prevent webpage scrolling using mouse wheel
            event.preventDefault();

            process_camera_movement(
                0.0,
                0.0,
                mouse_movement_dist * event.deltaY
            );
        }, false);
    }

    function process_camera_movement(dx, dy, dz, center_translate = false) {
        if (!center_translate) {
            // Modify azimuth angle (horizontal movement)
            cam_azimuth += dx;

            // Modify zenith angle (vertical movement)
            cam_zenith += dy;

            // Modify camera distance (mouse wheel)
            cam_radius += dz;
        }
        // If the action is a translation of the camera's sphere
        else {
            glMatrix.vec3.add(
                world_center,
                world_center,
                glMatrix.vec3.fromValues(dx, dy, dz)
            );
        }

        // Update camera vectors according to new angles
        update_camera_vectors();
    }

    function get_view_matrix() {
        glMatrix.mat4.lookAt(View, cam_position, world_center, cam_up);
        return View;
    }

    function get_projection(fov = 45.0, ratio = 1.0, near = 0.01, far = 100.0) {
        const projection = glMatrix.mat4.create();
        glMatrix.mat4.perspective(projection, deg2rad(fov), ratio, near, far);
        return projection;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180.0);
    }

    function update_camera_vectors() {
        // Bound spherical coordinates
        cam_zenith  = Math.max(zenith_min,  Math.min(zenith_max,  cam_zenith % 360));
        cam_azimuth = Math.max(azimuth_min, Math.min(azimuth_max, cam_azimuth % 360));
        cam_radius  = Math.max(radius_min,  Math.min(radius_max,  cam_radius));

        const zenith_r  = deg2rad(cam_zenith)
        const azimuth_r = deg2rad(cam_azimuth)

        // Compute cartesian coordinates from polar
        // WARNING: OpenGL coordinates are Y-axis UP, Z-axis backward!
        const x = cam_radius * Math.cos(azimuth_r) * Math.sin(zenith_r);
        const y = cam_radius * Math.cos(zenith_r);
        const z = -cam_radius * Math.sin(azimuth_r) * Math.sin(zenith_r);

        // Position vector
        glMatrix.vec3.set(cam_position, x, y, z);
        glMatrix.vec3.add(cam_position, cam_position, world_center);

        // Compute the front normalized vector
        glMatrix.vec3.sub(cam_front, world_center, cam_position);
        glMatrix.vec3.normalize(cam_front, cam_front);

        // Compute camera right normalized vector from front and world_up
        glMatrix.vec3.cross(cam_right, cam_front, world_up);
        glMatrix.vec3.normalize(cam_right, cam_right);

        // Compute camera up normalized vector as cross product
        // between right and front vectors
        glMatrix.vec3.cross(cam_up, cam_right, cam_front);
        glMatrix.vec3.normalize(cam_up, cam_up);
    }

    function get_position() {
        return cam_position;
    }

    function show_view_html(tag, view) {
        show_mat(tag, 'View', view);
    }

    function show_projection_html(tag, projection) {
        show_mat(tag, 'Proj', projection);
    }

    // print a float with fixed decimals
    function fl(x) {
        return Number.parseFloat(x).toFixed(3);
    }

    function show_mat(tag, name, m) {
        // WARNING: rounded fixed floating points using fl(x)
        let txt = name + ':<br />';
        txt += fl(m[0]) + ' ' + fl(m[4]) + ' ' + fl(m[8]) + ' ' + fl(m[12]) + '<br />'
        txt += fl(m[1]) + ' ' + fl(m[5]) + ' ' + fl(m[9]) + ' ' + fl(m[13]) + '<br />'
        txt += fl(m[2]) + ' ' + fl(m[6]) + ' ' + fl(m[10]) + ' ' + fl(m[14]) + '<br />'
        txt += fl(m[3]) + ' ' + fl(m[7]) + ' ' + fl(m[11]) + ' ' + fl(m[15]) + '<br />'
        tag.innerHTML = txt;
    }

    return {
        get_view_matrix: get_view_matrix,
        get_projection: get_projection,
        get_position: get_position,
        show_projection_html: show_projection_html,
        show_view_html: show_view_html,
    }
};
