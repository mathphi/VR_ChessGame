const make_material = function (
    gl,
    intrinsic_color = glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
    specular_exp = 32.0,
    specular_strength = 0.8,
    reflect_strength = 0.0,
    refract_strength = 0.0,
    refract_index = 1.0
) {

    function set_color(color) {
        intrinsic_color = color;
    }
    function set_specular(spec_exp, spec_strength) {
        specular_exp = spec_exp;
        specular_strength = spec_strength;
    }
    function set_reflection(refl_strength) {
        reflect_strength = refl_strength;
    }
    function set_refraction(refr_strength, refr_index) {
        refract_strength = refr_strength;
        refract_index = refr_index;
    }

    function activate(shader) {
        // Send visual properties to shader
        const u_object_color        = gl.getUniformLocation(shader.program, 'u_object_color');
        const u_specular_exp        = gl.getUniformLocation(shader.program, 'u_specular_exp');
        const u_specular_strength   = gl.getUniformLocation(shader.program, 'u_specular_strength');
        const u_reflect_strength    = gl.getUniformLocation(shader.program, 'u_reflect_strength');
        const u_refract_strength    = gl.getUniformLocation(shader.program, 'u_refract_strength');
        const u_refract_index       = gl.getUniformLocation(shader.program, 'u_refract_index');

        gl.uniform3fv(u_object_color,       intrinsic_color);
        gl.uniform1f(u_specular_exp,       specular_exp);
        gl.uniform1f(u_specular_strength,  specular_strength);
        gl.uniform1f(u_reflect_strength,   reflect_strength);
        gl.uniform1f(u_refract_strength,   refract_strength);
        gl.uniform1f(u_refract_index,      refract_index);
    }

    return {
        activate: activate,
        set_color: set_color,
        set_specular: set_specular,
        set_reflection: set_reflection,
        set_refraction: set_refraction
    }
}