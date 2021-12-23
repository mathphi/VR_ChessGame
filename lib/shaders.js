const make_shader = async function (gl, shader_name, shaders_dir = 'shaders/') {
    async function load_shaders_source(name, shaders_dir) {
        const vert_shader_file = shaders_dir + '/' + name + '_vert.glsl';
        const frag_shader_file = shaders_dir + '/' + name + '_frag.glsl';

        const response_V = await fetch(vert_shader_file);
        const response_F = await fetch(frag_shader_file);

        return {
            source_v: await response_V.text(),
            source_f: await response_F.text()
        };
    }

    function compile_shader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            throw new Error('Failed to compile ' + type + ' shader');
        }

        return shader;
    }

    function create_program(vertex_shader, fragment_shader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertex_shader);
        gl.attachShader(program, fragment_shader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            throw new Error('Unable to compile GL program');
        }

        return program;
    }

    function set_model_uniform(model) {
        const u_M = gl.getUniformLocation(program, 'M');

        // We need to send the inverse transpose of the model matrix for the model
        const u_itM = gl.getUniformLocation(program, 'itM');

        // Send model matrix and its inverse to shader
        gl.uniformMatrix4fv(u_M, false, model);
        const itM = glMatrix.mat4.create();
        glMatrix.mat4.invert(itM, model);
        glMatrix.mat4.transpose(itM, itM);
        gl.uniformMatrix4fv(u_itM, false, itM);
    }

    function set_view_uniform(view) {
        const u_V = gl.getUniformLocation(program, 'V');
        gl.uniformMatrix4fv(u_V, false, view);
    }

    function set_projection_uniform(proj) {
        const u_P = gl.getUniformLocation(program, 'P');
        gl.uniformMatrix4fv(u_P, false, proj);
    }

    function get_uniforms() {
        const u_M = gl.getUniformLocation(program, 'M');
        const u_V = gl.getUniformLocation(program, 'V');
        const u_P = gl.getUniformLocation(program, 'P');

        // We need to send the inverse transpose of the model matrix for the model
        const u_itM = gl.getUniformLocation(program, 'itM');

        return {
            "model": u_M,
            "view":  u_V,
            "proj":  u_P,
            "inv_m": u_itM
        }
    }

    function use() {
        gl.useProgram(program);
    }

    const shader_sources = await load_shaders_source(shader_name, shaders_dir);

    const shaderV = compile_shader(shader_sources['source_v'], gl.VERTEX_SHADER);
    const shaderF = compile_shader(shader_sources['source_f'], gl.FRAGMENT_SHADER);

    const program = create_program(shaderV, shaderF);

    return {
        program: program,
        set_view_uniform: set_view_uniform,
        set_projection_uniform: set_projection_uniform,
        set_model_uniform: set_model_uniform,
        get_uniforms: get_uniforms,
        use: use,
    }
};