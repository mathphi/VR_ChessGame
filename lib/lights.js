const make_lights_set = function (gl) {
    const LightType = {
        POINT:  0,
        SPOT:   1
    }

    // This light ID is incremented at each added light
    let light_id = 0;

    // List of lights in the lights-set
    const lights_list = [];

    function get_flat_float32array(param_name, unit_length) {
        const values = new Float32Array(unit_length * lights_list.length);
        const light_ids = Object.keys(lights_list);

        let i = 0;
        for (const id of light_ids) {
            values.set(lights_list[id][param_name], i * unit_length);
            i++;
        }

        return values;
    }

    function add_point_light(position, color) {
        // Attribute the current light_id to this light
        const id = light_id;
        lights_list[id] = {
            type: LightType.POINT,
            position: position,
            color: color,
            direction: glMatrix.vec3.fromValues(0.0, 0.0, 0.0),
            inner_angle: 0,
            outer_angle: 0
        }
        light_id++;

        return id;
    }

    function add_spot_light(position, color, direction, inner_angle, outer_angle) {
        // Attribute the current light_id to this light
        const id = light_id;

        // Ensure the direction is normalized
        const dir_norm = glMatrix.vec3.create();
        glMatrix.vec3.normalize(dir_norm, direction);

        // Inner and outer angles in degrees
        lights_list[id] = {
            type: LightType.SPOT,
            position: position,
            color: color,
            direction: dir_norm,
            inner_angle: inner_angle * Math.PI / 180.0,
            outer_angle: outer_angle * Math.PI / 180.0
        }
        light_id++;

        return id;
    }

    function set_light_position(light_id, new_pos) {
        lights_list[light_id]['position'] = new_pos;
    }
    function set_light_color(light_id, new_color) {
        lights_list[light_id]['color'] = new_color;
    }
    function set_light_direction(light_id, new_dir, new_in_angle = -1, new_out_angle = -1) {
        // Ensure the direction is normalized
        const dir_norm = glMatrix.vec3.create();
        glMatrix.vec3.normalize(dir_norm, new_dir);
        lights_list[light_id]['direction'] = dir_norm;

        if (new_in_angle !== -1) {
            lights_list[light_id]['inner_angle'] = new_in_angle;
        }
        if (new_out_angle !== -1) {
            lights_list[light_id]['outer_angle'] = new_out_angle;
        }
    }

    function remove_light(light_id) {
        delete lights_list[light_id];
    }

    function lights_count() {
        return lights_list.length;
    }
    function get_types() {
        return lights_list.flatMap(light => light['type']);
    }
    function get_positions() {
        return get_flat_float32array('position', 3);
    }
    function get_colors() {
        return get_flat_float32array('color', 3);
    }
    function get_directions() {
        return get_flat_float32array('direction', 3);
    }
    function get_inner_angles() {
        return lights_list.flatMap(light => light['inner_angle']);
    }
    function get_outer_angles() {
        return lights_list.flatMap(light => light['outer_angle']);
    }

    function activate(shader) {
        // Get location of all light uniforms
        const u_lights_count = gl.getUniformLocation(shader.program, 'u_lights_count');
        const u_lights_type  = gl.getUniformLocation(shader.program, 'u_lights_type');
        const u_lights_pos   = gl.getUniformLocation(shader.program, 'u_lights_position');
        const u_lights_color = gl.getUniformLocation(shader.program, 'u_lights_color');
        const u_lights_dir   = gl.getUniformLocation(shader.program, 'u_lights_direction');
        const u_lights_in_a  = gl.getUniformLocation(shader.program, 'u_lights_in_angle');
        const u_lights_out_a = gl.getUniformLocation(shader.program, 'u_lights_out_angle');

        // Send data for all lights to the shader
        gl.uniform1i(u_lights_count,  lights_count());
        gl.uniform1iv(u_lights_type,  get_types());
        gl.uniform3fv(u_lights_pos,   get_positions());
        gl.uniform3fv(u_lights_color, get_colors());
        gl.uniform3fv(u_lights_dir,   get_directions());
        gl.uniform1fv(u_lights_in_a,  get_inner_angles());
        gl.uniform1fv(u_lights_out_a, get_outer_angles());
    }

    return {
        add_point_light: add_point_light,
        add_spot_light: add_spot_light,
        activate: activate,
        set_light_position: set_light_position,
        set_light_color: set_light_color,
        set_light_direction: set_light_direction,
        remove_light: remove_light
    }
};