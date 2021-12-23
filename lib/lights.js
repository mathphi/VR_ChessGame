const make_lights_set = function (gl) {

    // List of lights in the lights-set
    const lights_list = [];

    function get_flat_float32array(param_name, unit_length) {
        const values = new Float32Array(unit_length * lights_list.length);

        for (let i = 0; i < lights_list.length; i++) {
            values.set(lights_list[i][param_name], i * unit_length);
        }

        return values;
    }

    function add_light(position, color, intensity) {
        lights_list.push({
            position: position,
            color: color,
            intensity: intensity
        });
    }

    function lights_count() {
        return lights_list.length;
    }

    function get_positions() {
        return get_flat_float32array('position', 3);
    }

    function get_colors() {
        return get_flat_float32array('color', 3);
    }

    function get_intensities() {
        return lights_list.flatMap(light => light['intensity']);
    }

    function activate(shader) {
        // Get location of all light uniforms
        const u_lights_count = gl.getUniformLocation(shader.program, 'u_lights_count');
        const u_lights_pos   = gl.getUniformLocation(shader.program, 'u_lights_position');
        const u_lights_color = gl.getUniformLocation(shader.program, 'u_lights_color');
        const u_lights_int   = gl.getUniformLocation(shader.program, 'u_lights_intensity');

        // Send data for all lights to the shader
        gl.uniform1i(u_lights_count,  lights_count());
        gl.uniform3fv(u_lights_pos,   get_positions());
        gl.uniform3fv(u_lights_color, get_colors());
        gl.uniform1fv(u_lights_int,   get_intensities());
    }

    return {
        add_light: add_light,
        activate: activate
    }
};