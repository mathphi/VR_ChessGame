const load_obj = async function (name, load_uv = true) {
    async function load_mesh(string) {
        const lines = string.split("\n");
        const positions = [];
        const normals = [];
        const textures = [];
        const vertices = [];

        let current_vertex = 0;
        let materials = null;
        const material_indices = [];

        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].trimRight().split(' ');
            if (parts.length > 0) {
                switch (parts[0]) {
                    case 'mtllib':
                        materials = await load_materials_from_file(parts[1], name);
                        break;
                    case 'usemtl':
                        // The list material_indices indicates the index of the first vertex
                        // which uses the corresponding material name
                        material_indices.push({
                            vert: current_vertex,
                            mtl_name: parts[1]
                        });
                        break;
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
                        if (load_uv) {
                            Array.prototype.push.apply(
                                vertices, textures[parseInt(f1[1]) - 1]
                            );
                        }
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f1[2]) - 1]
                        );
                        // Push vertex 2 of the face
                        Array.prototype.push.apply(
                            vertices, positions[parseInt(f2[0]) - 1]
                        );
                        if (load_uv) {
                            Array.prototype.push.apply(
                                vertices, textures[parseInt(f2[1]) - 1]
                            );
                        }
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f2[2]) - 1]
                        );
                        // Push vertex 3 of the face
                        Array.prototype.push.apply(
                            vertices, positions[parseInt(f3[0]) - 1]
                        );
                        if (load_uv) {
                            Array.prototype.push.apply(
                                vertices, textures[parseInt(f3[1]) - 1]
                            );
                        }
                        Array.prototype.push.apply(
                            vertices, normals[parseInt(f3[2]) - 1]
                        );

                        // Increment the vertex counter (by 3 since it is a triangle)
                        current_vertex += 3;
                        break;
                    }
                }
            }
        }

        const vertexSize = (load_uv ? 8 : 6);
        const vertexCount = vertices.length / vertexSize;
        console.log("Loaded mesh with " + vertexCount + " vertices");
        return {
            buffer: new Float32Array(vertices),
            num_vertices: vertexCount,
            has_uv: load_uv,
            vert_length: vertexSize,
            materials: materials,
            mtl_indices: material_indices
        };
    }

    // Boilerplate code for loading the object asynchronously:
    const response = await fetch(name);
    const text = await response.text();

    return await load_mesh(text);
};

const make_object = async function (gl, obj, texture = null, bump_map = null, material = null) {
    // We need the object to be ready to proceed:
    obj = await obj;

    // Default materials and material indices
    let object_materials = {
        default: make_material('default')
    };
    let material_indices = [
        {vert: 0, mtl_name: 'default'}
    ];

    if (material !== null) {
        object_materials = {
            [material.name]: material
        };
        material_indices = [
            {vert: 0, mtl_name: material.name}
        ];
    }
    else if (obj.materials !== null) {
        object_materials = obj.materials;
        material_indices = obj.mtl_indices;
    }

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

    // Object's vertices buffer
    const vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.buffer, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    function draw(shader) {
        // these object have all 3 positions + 2 textures + 3 normals
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        const sizeofFloat = Float32Array.BYTES_PER_ELEMENT;

        // Send model matrix to shader
        shader.set_model_uniform(model);

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

        for (let i = 0 ; i <  material_indices.length ; i++) {
            // Compute offset and number of vertices to draw
            const offset = material_indices[i].vert;
            const next_end = (i < material_indices.length-1) ? material_indices[i+1].vert : obj.num_vertices;
            const num_vert = next_end - offset;
            const buf_offset = offset * obj.vert_length;

            // Send material properties
            object_materials[material_indices[i].mtl_name].activate(gl, shader);

            // Send mesh buffers to shader (vertices, textures, normals)
            const a_position = gl.getAttribLocation(shader.program, 'a_position');
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, obj.vert_length * sizeofFloat, buf_offset * sizeofFloat);

            if (obj.has_uv) {
                const a_texcoord = gl.getAttribLocation(shader.program, "a_texcoord");
                gl.enableVertexAttribArray(a_texcoord);
                gl.vertexAttribPointer(a_texcoord, 2, gl.FLOAT, false, obj.vert_length * sizeofFloat, (buf_offset + 3) * sizeofFloat);
            }

            const a_normal = gl.getAttribLocation(shader.program, 'a_normal');
            gl.enableVertexAttribArray(a_normal);
            gl.vertexAttribPointer(a_normal, 3, gl.FLOAT, false, obj.vert_length * sizeofFloat, (buf_offset + obj.vert_length - 3) * sizeofFloat);

            // If bump mapping is enabled for this object
            if (bump_map !== null) {
                // Use the tangent space buffer
                gl.bindBuffer(gl.ARRAY_BUFFER, tan_space_buf);

                const att_tangent = gl.getAttribLocation(shader.program, 'a_tangent');
                gl.enableVertexAttribArray(att_tangent);
                gl.vertexAttribPointer(att_tangent, 3, gl.FLOAT, false, 6 * sizeofFloat, buf_offset * sizeofFloat);

                const att_bitangent = gl.getAttribLocation(shader.program, 'a_bitangent');
                gl.enableVertexAttribArray(att_bitangent);
                gl.vertexAttribPointer(att_bitangent, 3, gl.FLOAT, false, 6 * sizeofFloat, (buf_offset + 3) * sizeofFloat);

                const u_bump_map = gl.getUniformLocation(shader.program, 'u_bump_map');
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, bump_map);
                gl.uniform1i(u_bump_map, 1);    // Texture index
            }

            // Draw a certain number of triangles corresponding to this material
            gl.drawArrays(gl.TRIANGLES, 0, num_vert);
        }
    }

    return {
        buffer: vertex_buffer,
        model: model,
        draw: draw,
        materials: object_materials
    }
};
