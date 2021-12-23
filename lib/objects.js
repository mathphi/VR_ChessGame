const load_obj = async function (name) {
    async function load_mesh(string) {
        const lines = string.split("\n");
        const positions = [];
        const normals = [];
        const textures = [];
        const vertices = [];

        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].trimRight().split(' ');
            if (parts.length > 0) {
                switch (parts[0]) {
                    case 'v':
                        positions.push(
                            glMatrix.vec3.fromValues(
                                parseFloat(parts[1]),
                                parseFloat(parts[2]),
                                parseFloat(parts[3])
                            ));
                        break;
                    case 'vn':
                        normals.push(
                            glMatrix.vec3.fromValues(
                                parseFloat(parts[1]),
                                parseFloat(parts[2]),
                                parseFloat(parts[3])
                            ));
                        break;
                    case 'vt':
                        textures.push(
                            glMatrix.vec2.fromValues(
                                parseFloat(parts[1]),
                                parseFloat(parts[2])
                            ));
                        break;
                    case 'f': {
                        // f = vertex/texture/normal vertex/texture/normal vertex/texture/normal
                        const f1 = parts[1].split('/');
                        const f2 = parts[2].split('/');
                        const f3 = parts[3].split('/');
                        // Push vertex 1 of the face
                        Array.prototype.push.apply(
                            vertices, positions[parseInt(f1[0]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, textures[parseInt(f1[1]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f1[2]) - 1]
                        );
                        // Push vertex 2 of the face
                        Array.prototype.push.apply(
                            vertices, positions[parseInt(f2[0]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, textures[parseInt(f2[1]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f2[2]) - 1]
                        );
                        // Push vertex 3 of the face
                        Array.prototype.push.apply(
                            vertices, positions[parseInt(f3[0]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, textures[parseInt(f3[1]) - 1]
                        );
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f3[2]) - 1]
                        );
                        break;
                    }
                }
            }
        }

        const vertexCount = vertices.length / 8;
        console.log("Loaded mesh with " + vertexCount + " vertices");
        return {
            buffer: new Float32Array(vertices),
            num_triangles: vertexCount
        };
    }

    // Boilerplate code for loading the object asynchronously:
    const response = await fetch(name);
    const text = await response.text();

    return await load_mesh(text);
};

const make_object = async function (gl, obj, texture = null, bump_map = null) {
    // We need the object to be ready to proceed:
    obj = await obj;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.buffer, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Model matrix for this object
    const model = glMatrix.mat4.create();

    // Create buffer for tangent space (used only in case of bump mapping)
    const tan_space_buf = gl.createBuffer();

    // If bump mapping is applied for this object
    if (bump_map !== null) {
        // Compute tangent space for the object
        const tangent_space = object_tangent_space(obj);

        // Fill buffers for tangent space
        gl.bindBuffer(gl.ARRAY_BUFFER, tan_space_buf);
        gl.bufferData(gl.ARRAY_BUFFER, tangent_space, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    function activate(shader) {
        // these object have all 3 positions + 2 textures + 3 normals
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const sizeofFloat = Float32Array.BYTES_PER_ELEMENT;

        // Send model matrix to shader
        shader.set_model_uniform(model);

        // Send mesh buffers to shader (vertices, textures, normals)
        const att_pos = gl.getAttribLocation(shader.program, 'a_position');
        gl.enableVertexAttribArray(att_pos);
        gl.vertexAttribPointer(att_pos, 3, gl.FLOAT, false, 8 * sizeofFloat, 0);

        const att_texcoord = gl.getAttribLocation(shader.program, "a_texcoord");
        gl.enableVertexAttribArray(att_texcoord);
        gl.vertexAttribPointer(att_texcoord, 2, gl.FLOAT, false, 8 * sizeofFloat, 3 * sizeofFloat);

        const att_nor = gl.getAttribLocation(shader.program, 'a_normal');
        gl.enableVertexAttribArray(att_nor);
        gl.vertexAttribPointer(att_nor, 3, gl.FLOAT, false, 8 * sizeofFloat, 5 * sizeofFloat);

        // Indicate to shader that a texture must be painted
        const u_has_texture = gl.getUniformLocation(shader.program, 'u_has_texture');
        gl.uniform1i(u_has_texture, (texture !== null ? 1 : 0));

        // Indicate to shader that a bump map is used
        const u_has_bumpmap = gl.getUniformLocation(shader.program, 'u_has_bumpmap');
        gl.uniform1i(u_has_bumpmap, (bump_map !== null ? 1 : 0));

        // If a texture is defined
        if (texture !== null) {
            const u_texture = gl.getUniformLocation(shader.program, 'u_texture');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(u_texture, 0);    // Texture index
        }

        // If bump mapping is enabled for this object
        if (bump_map !== null) {
            // Use the tangent space buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, tan_space_buf);

            const att_tangent = gl.getAttribLocation(shader.program, 'a_tangent');
            gl.enableVertexAttribArray(att_tangent);
            gl.vertexAttribPointer(att_tangent, 3, gl.FLOAT, false, 6 * sizeofFloat, 0);

            const att_bitangent = gl.getAttribLocation(shader.program, 'a_bitangent');
            gl.enableVertexAttribArray(att_bitangent);
            gl.vertexAttribPointer(att_bitangent, 3, gl.FLOAT, false, 6 * sizeofFloat, 3 * sizeofFloat);

            const u_bump_map = gl.getUniformLocation(shader.program, 'u_bump_map');
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, bump_map);
            gl.uniform1i(u_bump_map, 1);    // Texture index
        }
    }

    function draw() {
        gl.drawArrays(gl.TRIANGLES, 0, obj.num_triangles);
    }

    return {
        buffer: buffer,
        model: model,
        activate: activate,
        draw: draw,
    }
};
