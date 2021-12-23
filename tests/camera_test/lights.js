var make_lights_set = function () {

    let lights_list = [];

    function add_light(position, color, intensity) {
        lights_list.push({
            position: position,
            color: color,
            intensity: intensity
        });
    }

    function get_flat_float32array(param_name, unit_length) {
        const values = new Float32Array(unit_length * lights_list.length);

        for (let i = 0 ; i < lights_list.length ; i++) {
            values.set(lights_list[i][param_name], i*unit_length);
        }

        return values;
    }

    return {
        add_light: add_light,
        lights_count: function() {
            return lights_list.length;
        },
        get_positions: function() {
            return get_flat_float32array('position', 3);
        },
        get_colors: function() {
            return get_flat_float32array('color', 3);
        },
        get_intensities: function() {
            return lights_list.flatMap(light => light['intensity']);
        }
    }
}