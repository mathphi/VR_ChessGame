const make_shader = function (gl, vertex_shader, fragment_shader) {
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
        let program = gl.createProgram();
        gl.attachShader(program, vertex_shader);
        gl.attachShader(program, fragment_shader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            throw new Error('Unable to compile program');
        }

        return program;
    }

    function get_uniforms() {
        const u_M = gl.getUniformLocation(program, 'M');
        const u_V = gl.getUniformLocation(program, 'V');
        const u_P = gl.getUniformLocation(program, 'P');
        return {
            "model": u_M,
            "view": u_V,
            "proj": u_P,
        }
    }

    function use() {
        gl.useProgram(program);
    }

    const shaderV = compile_shader(vertex_shader, gl.VERTEX_SHADER);
    const shaderF = compile_shader(fragment_shader, gl.FRAGMENT_SHADER);

    const program = create_program(shaderV, shaderF);

    return {
        program: program,
        get_uniforms: get_uniforms,
        use: use,
    }
};