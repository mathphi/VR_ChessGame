const make_material = function (
    name,
    intrinsic_color = glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
    specular_exp = 32.0,
    specular_strength = 0.8,
    reflect_strength = 0.0,
    refract_strength = 0.0,
    refract_index = 1.0,
    force_no_texture = false,
    force_no_bumpmap = false
) {

    function set_color(color) {
        intrinsic_color = color;
    }
    function set_specular(spec_exp, spec_strength) {
        specular_exp = spec_exp;
        specular_strength = spec_strength;
    }
    function set_spec_exp(spec_exp) {
        specular_exp = spec_exp;
    }
    function set_spec_strength(spec_strength) {
        specular_strength = spec_strength;
    }
    function set_reflection(refl_strength) {
        reflect_strength = refl_strength;
    }
    function set_refraction(refr_strength, refr_index) {
        refract_strength = refr_strength;
        refract_index = refr_index;
    }
    function set_refr_strength(refr_strength) {
        refract_strength = refr_strength;
    }
    function set_refr_index(refr_index) {
        refract_index = refr_index;
    }
    function set_force_no_texture(no_texture) {
        force_no_texture = no_texture;
    }
    function set_force_no_bumpmap(no_bump) {
        force_no_bumpmap = no_bump;
    }

    function activate(gl, shader) {
        // Send visual properties to shader
        const u_object_color        = gl.getUniformLocation(shader.program, 'u_object_color');
        const u_specular_exp        = gl.getUniformLocation(shader.program, 'u_specular_exp');
        const u_specular_strength   = gl.getUniformLocation(shader.program, 'u_specular_strength');
        const u_reflect_strength    = gl.getUniformLocation(shader.program, 'u_reflect_strength');
        const u_refract_strength    = gl.getUniformLocation(shader.program, 'u_refract_strength');
        const u_refract_index       = gl.getUniformLocation(shader.program, 'u_refract_index');
        const u_force_no_texture    = gl.getUniformLocation(shader.program, 'u_force_no_texture');
        const u_force_no_bumpmap    = gl.getUniformLocation(shader.program, 'u_force_no_bumpmap');

        gl.uniform3fv(u_object_color,       intrinsic_color);
        gl.uniform1f(u_specular_exp,        specular_exp);
        gl.uniform1f(u_specular_strength,   specular_strength);
        gl.uniform1f(u_reflect_strength,    reflect_strength);
        gl.uniform1f(u_refract_strength,    refract_strength);
        gl.uniform1f(u_refract_index,       refract_index);
        gl.uniform1f(u_force_no_texture,    force_no_texture);
        gl.uniform1f(u_force_no_bumpmap,    force_no_bumpmap);
    }

    return {
        name: name,
        set_color: set_color,
        set_specular: set_specular,
        set_spec_exp: set_spec_exp,
        set_spec_strength: set_spec_strength,
        set_reflection: set_reflection,
        set_refraction: set_refraction,
        set_refr_strength: set_refr_strength,
        set_refr_index: set_refr_index,
        set_force_no_texture: set_force_no_texture,
        set_force_no_bumpmap: set_force_no_bumpmap,
        activate: activate
    }
}

const load_materials_from_file = async function (mtl_file, obj_file) {
    const materials = [];

    // Get the material file
    const parent_dir = obj_file.substr(0, obj_file.lastIndexOf("/"));
    const response = await fetch(parent_dir + "/" + mtl_file);
    const mtl_content = await response.text();

    const lines = mtl_content.split("\n");
    let current_mtl_name = 'default';

    // Parse each line of the file
    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].trimRight().split(' ');
        if (parts.length > 0) {
            switch (parts[0]) {
                case 'newmtl':
                    // Create a new element in material list
                    current_mtl_name = parts[1];
                    materials[current_mtl_name] = make_material(parts[1]);
                    break;
                case 'Color':
                    materials[current_mtl_name].set_color(
                        glMatrix.vec3.fromValues(
                            parseFloat(parts[1]),
                            parseFloat(parts[2]),
                            parseFloat(parts[3])
                        )
                    );
                    break;
                case 'Spec_e':
                    materials[current_mtl_name].set_spec_exp(parseFloat(parts[1]));
                    break;
                case 'Spec_s':
                    materials[current_mtl_name].set_spec_strength(parseFloat(parts[1]));
                    break;
                case 'Refl_s':
                    materials[current_mtl_name].set_reflection(parseFloat(parts[1]));
                    break;
                case 'Refr_s':
                    materials[current_mtl_name].set_refr_strength(parseFloat(parts[1]));
                    break;
                case 'Refr_i':
                    materials[current_mtl_name].set_refr_index(parseFloat(parts[1]));
                    break;
                case 'NoTex':
                    materials[current_mtl_name].set_force_no_texture(parts[1] === "Yes");
                    break;
                case 'NoBump':
                    materials[current_mtl_name].set_force_no_bumpmap(parts[1] === "Yes");
                    break;
            }
        }
    }

    return materials;
}