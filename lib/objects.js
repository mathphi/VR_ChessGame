const load_obj = async function (name, load_uv = true, scale = glMatrix.vec3.fromValues(1.0, 1.0, 1.0)) {
    async function load_mesh(string) {
        const lines = string.split("\n");
        const positions = [];
        const normals = [];
        const textures = [];
        const vertices = [];

        let current_vertex = 0;
        let materials = [];
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
                                parseFloat(parts[1]) * scale[0],
                                parseFloat(parts[2]) * scale[1],
                                parseFloat(parts[3]) * scale[2]
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
        const slash_idx = name.lastIndexOf("/");
        const filename = name.substr(slash_idx+1, name.length - slash_idx - 1);
        console.log("Loaded mesh '" + filename + "' with " + vertexCount + " vertices and " + material_indices.length + " materials");
        return {
            buffer: new Float32Array(vertices),
            points: positions,
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

const make_object = function (gl, obj, texture = null, bump_map = null, material = null) {
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
    else if (Object.keys(obj.materials).length !== 0) {
        object_materials = obj.materials;
        material_indices = obj.mtl_indices;
    }

    // Object state properties
    let _is_highlighted = false;

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
        const sizeofFloat = Float32Array.BYTES_PER_ELEMENT;

        // Send model matrix to shader
        shader.set_model_uniform(model);

        // Indicate to shader that a texture must be painted
        const u_is_highlighted = gl.getUniformLocation(shader.program, 'u_is_highlighted');
        gl.uniform1i(u_is_highlighted, _is_highlighted);

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

            // Bind the vertex buffer to GL
            gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

            // Send mesh buffers to shader (vertices, textures, normals)
            const a_position = gl.getAttribLocation(shader.program, 'a_position');
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, obj.vert_length * sizeofFloat, buf_offset * sizeofFloat);

            if (obj.has_uv && texture !== null) {
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
                gl.vertexAttribPointer(att_tangent, 3, gl.FLOAT, false, 6 * sizeofFloat, offset * 6 * sizeofFloat);

                const att_bitangent = gl.getAttribLocation(shader.program, 'a_bitangent');
                gl.enableVertexAttribArray(att_bitangent);
                gl.vertexAttribPointer(att_bitangent, 3, gl.FLOAT, false, 6 * sizeofFloat, (offset * 6 + 3) * sizeofFloat);

                const u_bump_map = gl.getUniformLocation(shader.program, 'u_bump_map');
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, bump_map);
                gl.uniform1i(u_bump_map, 1);    // Texture index
            }

            // Draw a certain number of triangles corresponding to this material
            gl.drawArrays(gl.TRIANGLES, 0, num_vert);
        }
    }

    function set_highlighted(highlighted) {
        _is_highlighted = highlighted;
    }
    function is_highlighted() {
        return _is_highlighted;
    }

    function get_rotation() {
        const rotation = glMatrix.quat.create();
        glMatrix.mat4.getRotation(rotation, model);
        return rotation;
    }
    function set_rotation(axis, angle) {
        const position = get_position();
        const scaling  = get_scaling();
        const rotation = glMatrix.quat.create();
        glMatrix.quat.setAxisAngle(rotation, axis, angle);
        glMatrix.mat4.fromRotationTranslationScale(
            model, rotation, position, scaling
        );
        update_physics_transform();
    }
    function set_rotation_quat(quaternion) {
        const position = get_position();
        const scaling  = get_scaling();
        glMatrix.mat4.fromRotationTranslationScale(
            model, quaternion, position, scaling
        );
        update_physics_transform();
    }
    function rotate_position(axis, angle) {
        glMatrix.mat4.rotate(model, model, angle, axis);
        update_physics_transform();
    }
    function rotate_around(axis, rot_center, angle) {
        const position = get_position();
        const rotation = get_rotation();
        const scaling  = get_scaling();
        const delta_pos= glMatrix.vec3.create();

        // Get the vector between initial position and rotation center
        glMatrix.vec3.sub(delta_pos, position, rot_center);

        // Rotate the difference vector
        const rot_mat = glMatrix.mat4.create();
        glMatrix.mat4.fromRotation(rot_mat, angle, axis);
        glMatrix.vec3.transformMat4(delta_pos, delta_pos, rot_mat);

        // Move position from rotation center
        glMatrix.vec3.add(position, rot_center, delta_pos);

        // Place object to rotation center
        glMatrix.mat4.fromRotationTranslationScale(model, rotation, position, scaling);

        // Rotate the object (self-rotation)
        glMatrix.mat4.rotate(model, model, angle, axis);

        update_physics_transform();
    }
    function get_position() {
        const pos = glMatrix.vec3.create();
        glMatrix.mat4.getTranslation(pos, model);
        return pos;
    }
    function set_position(pos) {
        const rotation = get_rotation();
        const scaling  = get_scaling();
        glMatrix.mat4.fromRotationTranslationScale(
            model, rotation, pos, scaling
        );
        update_physics_transform();
    }
    function move_position(delta_pos) {
        glMatrix.mat4.translate(model, model, delta_pos);
        update_physics_transform();
    }
    function get_scaling() {
        const scale = glMatrix.vec3.create();
        glMatrix.mat4.getScaling(scale, model);
        return scale;
    }
    function set_scaling(scale) {
        const rotation = get_rotation();
        const position = get_position();
        glMatrix.mat4.fromRotationTranslationScale(
            model, rotation, position, scale
        );
        update_physics_transform();
    }

    /* * * * * * * * * * * * * * * * * * *
     *   Animated positioning functions  *
     * * * * * * * * * * * * * * * * * * */

    let _global_anim_id = 1;
    let _anim_move_id   = 0;
    let _anim_rotate_id = 0;

    function anim_to_position(position, duration, callback = null) {
        const init_pos  = get_position();
        const delta_pos = get_position();
        const init_t    = performance.now();
        const anim_id = _global_anim_id++;
        _anim_move_id = anim_id;

        // delta_pos = new_pos - current_pos
        glMatrix.vec3.sub(delta_pos, position, delta_pos);

        function animate(time) {
            // Exit animation if animation ID changed (only one move anim at a time on an object)
            if (_anim_move_id !== anim_id)
                return;

            const t = Math.max(0, time - init_t);
            const t_f = t / duration;
            const scale = (1 - Math.cos(Math.PI * t_f)) / 2.0;

            // Compute the current position at this time
            const current_pos = glMatrix.vec3.create();
            glMatrix.vec3.scale(current_pos, delta_pos, scale);
            glMatrix.vec3.add(current_pos, current_pos, init_pos);
            set_position(current_pos);

            if (t < duration) {
                window.requestAnimationFrame(animate);
            }
            else {
                set_position(position);

                if (typeof(callback) === "function") {
                    callback();
                }
            }
        }

        if (duration > 0.0) {
            animate(0);
        }
        else {
            set_position(position);
        }
    }

    /**
     * Move according to a 3rd order Bézier curve
     * @param p1: starting point
     * @param p2: intermediate point 1
     * @param p3: intermediate point 2
     * @param p4: end point
     * @param duration
     * @param callback
     */
    function anim_move_bezier_curve(p1, p2, p3, p4, duration, callback = null) {
        const init_t    = performance.now();
        const anim_id = _global_anim_id++;
        _anim_move_id = anim_id;

        // Current position buffer
        const current_pos   = glMatrix.vec3.create();
        const tmp_vect      = glMatrix.vec3.create();

        function animate(time) {
            // Exit animation if animation ID changed (only one move anim at a time on an object)
            if (_anim_move_id !== anim_id)
                return;

            const t = Math.max(0, time - init_t);
            const t_f = t / duration;
            const x = (1 - Math.cos(Math.PI * t_f)) / 2.0;

            // Apply the Bézier curve formula
            glMatrix.vec3.scale(current_pos, p1, Math.pow(1 - x, 3));
            glMatrix.vec3.scale(tmp_vect, p2, 3 * x * Math.pow(1 - x, 2));
            glMatrix.vec3.add(current_pos, current_pos, tmp_vect);
            glMatrix.vec3.scale(tmp_vect, p3, 3 * (1 - x) * Math.pow(x, 2));
            glMatrix.vec3.add(current_pos, current_pos, tmp_vect);
            glMatrix.vec3.scale(tmp_vect, p4, Math.pow(x, 3));
            glMatrix.vec3.add(current_pos, current_pos, tmp_vect);

            set_position(current_pos);

            if (t < duration) {
                window.requestAnimationFrame(animate);
            }
            else {
                set_position(p4);

                if (typeof(callback) === "function") {
                    callback();
                }
            }
        }

        if (duration > 0.0) {
            animate(0);
        }
        else {
            set_position(p4);
        }
    }

    function anim_move_above_pos(target_pos, up_offset, duration, callback = null) {
        // Initial object position
        const init_pos = get_position();

        // Compute the intermediate positions
        const inter_pos1 = glMatrix.vec3.create();

        // Add up_offset to first intermediate position
        glMatrix.vec3.add(inter_pos1, init_pos, glMatrix.vec3.fromValues(0.0, up_offset, 0.0));

        // The second intermediate position has the same Y as the first one, and same XZ as end point
        const inter_pos2 = glMatrix.vec3.fromValues(
            target_pos[0],
            inter_pos1[1],
            target_pos[2]
        );

        // Run animated move
        anim_move_bezier_curve(init_pos, inter_pos1, inter_pos2, target_pos, duration, callback);
    }

    function anim_to_rotation(rotation, duration, callback) {
        const init_rot  = get_rotation();
        const init_t    = performance.now();
        const anim_id = _global_anim_id++;
        _anim_rotate_id = anim_id;

        function animate(time) {
            // Exit this animation if its ID changed (only one move anim at a time on an object)
            if (_anim_rotate_id !== anim_id)
                return;

            const t = Math.max(0, time - init_t);
            const t_f = t / duration;
            const scale = (1 - Math.cos(Math.PI * t_f)) / 2.0;

            // Compute the current rotation at this time
            const current_rot = glMatrix.quat.create();
            glMatrix.quat.slerp(current_rot, init_rot, rotation, scale);
            set_rotation_quat(current_rot);

            if (t < duration) {
                window.requestAnimationFrame(animate);
            }
            else {
                set_rotation_quat(rotation);

                if (typeof(callback) === "function") {
                    callback();
                }
            }
        }

        if (duration > 0.0) {
            animate(0);
        }
        else {
            set_rotation_quat(rotation);
        }
    }

    /* * * * * * * * * * * * * * * * * * * *
     *   Physical body handling functions  *
     * * * * * * * * * * * * * * * * * * * */

    let physics_body = null;
    function set_physics_body(phys_body) {
        physics_body = phys_body;
    }
    function get_physics_body() {
        return physics_body;
    }
    function set_physics_mass(mass) {
        if (physics_body === null) {
            console.warn("Cannot set mass of an object without physics body");
            return;
        }

        physics_body.set_mass(mass);
    }

    const w_transform   = new Ammo.btTransform();
    const w_quaternion  = new Ammo.btQuaternion();
    const w_origin      = new Ammo.btVector3();
    const w_loc_scale   = new Ammo.btVector3();
    function update_physics_transform() {
        if (physics_body === null)
            return;

        const position = get_position();
        const rotation = get_rotation();
        const scaling  = get_scaling();

        const transform = glMatrix.mat4.create();
        glMatrix.mat4.fromRotationTranslationScale(
            transform,
            rotation,
            position,
            scaling
        );

        // Center of mass...
        const com = physics_body.com;

        // We translate by the center of mass (in the body direction)
        glMatrix.mat4.translate(transform, transform, glMatrix.vec3.fromValues(
            com.x(), com.y(), com.z()
        ));

        const r = glMatrix.quat.create();
        glMatrix.mat4.getRotation(r, transform);
        const p = glMatrix.vec3.create();
        glMatrix.mat4.getTranslation(p, transform);
        const s = glMatrix.vec3.create();
        glMatrix.mat4.getScaling(s, transform);

        // Compute world transform according to model matrix
        w_quaternion.setValue(r[0], r[1], r[2], r[3]);
        w_origin.setValue(p[0], p[1], p[2]);
        w_transform.setIdentity();
        w_transform.setRotation(w_quaternion);
        w_transform.setOrigin(w_origin);

        // Update scale of physics body
        w_loc_scale.setValue(scaling[0], scaling[1], scaling[2]);
        physics_body.getCollisionShape().setLocalScaling(w_loc_scale);

        // Cancel all motions
        reset_physics_motion();

        // Set the new transforms
        physics_body.setWorldTransform(w_transform);
        physics_body.getMotionState().setWorldTransform(w_transform);
    }

    // Create a null vector
    const null_vect = new Ammo.btVector3(0.0, 0.0, 0.0);
    function reset_physics_motion() {
        // Set the world transform to physics body
        physics_body.clearForces();
        physics_body.setAngularVelocity(null_vect);
        physics_body.setLinearVelocity(null_vect);
    }

    return {
        mesh: obj,
        model: model,
        draw: draw,
        materials: object_materials,
        set_highlighted: set_highlighted,
        is_highlighted: is_highlighted,
        get_rotation: get_rotation,
        set_rotation: set_rotation,
        set_rotation_quat: set_rotation_quat,
        rotate: rotate_position,
        rotate_around: rotate_around,
        get_position: get_position,
        set_position: set_position,
        move: move_position,
        get_scaling: get_scaling,
        set_scaling: set_scaling,

        anim_to_position: anim_to_position,
        anim_move_bezier_curve: anim_move_bezier_curve,
        anim_move_above_pos: anim_move_above_pos,
        anim_to_rotation: anim_to_rotation,

        set_physics_body: set_physics_body,
        get_physics_body: get_physics_body,
        set_physics_mass: set_physics_mass,
        update_physics_transform: update_physics_transform,
        reset_physics_motion: reset_physics_motion
    }
};
