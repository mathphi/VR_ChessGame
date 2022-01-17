const ParticleType = {
    Star:   1,
    Sphere: 2,
}

const make_particle = function (life, color, position, velocity, accel) {
    const _accel    = glMatrix.vec3.create();
    const _velocity = glMatrix.vec3.create();
    const _position = glMatrix.vec3.create();
    const _tmp_mat  = glMatrix.vec3.create();
    const _lifetime = life;

    // Initial values
    glMatrix.vec3.copy(_accel, accel);
    glMatrix.vec3.copy(_velocity, velocity);
    glMatrix.vec3.copy(_position, position);

    function is_alive() {
        return (life > 0.0);
    }

    function get_life() {
        return life;
    }

    function get_lifetime() {
        return _lifetime;
    }

    function get_position() {
        return _position;
    }

    function update(dt) {
        // Update particle life
        life -= dt;

        // Update particle position according to velocity
        glMatrix.vec3.scale(_tmp_mat, _velocity, dt);
        glMatrix.vec3.add(_position, _position, _tmp_mat);

        // Update particle velocity according to acceleration
        glMatrix.vec3.scale(_tmp_mat, _accel, dt);
        glMatrix.vec3.add(_velocity, _velocity, _tmp_mat);
    }

    return {
        is_alive: is_alive,
        get_life: get_life,
        get_lifetime: get_lifetime,
        get_position: get_position,
        update: update,
        color: color,
    }
}

function get_perp_vector(vector) {
    let perp_vect   = glMatrix.vec3.create();

    // Compute a perpendicular vector
    glMatrix.vec3.cross(perp_vect, vector, glMatrix.vec3.fromValues(0.0, 1.0, 0.0));
    glMatrix.vec3.normalize(perp_vect, perp_vect);

    // If its length is null -> vect is parallel to Y-axis
    if (glMatrix.vec3.length(perp_vect) === 0.0) {
        // In this case, Z-axis is a perpendicular vector
        perp_vect = glMatrix.vec3.fromValues(0.0, 0.0, 1.0);
    }

    return perp_vect;
}

/**
 * @param gl
 * @param camera
 * @param particle_type
 * @param ring_center:  Center of the ring
 * @param ring_radius:  Radius of the ring
 * @param direction:    Particle average movement direction
 * @param duration:     Lifetime of the dust
 * @param part_count:   Number of particles
 * @param part_size:    Size of particles
 * @param part_color:   Base particles color
 * @param cvf:          Color variation factor (random variation range around particles color)
 * @param _velocity_max
 * @param _acceleration
 * @param _lateral_velocity
 */
const make_particle_jet = async function (
    gl, camera,
    particle_type,
    ring_center, ring_radius, direction,
    duration,
    part_count, part_size,
    part_color, cvf,
    _velocity_max, _acceleration, _lateral_velocity
) {
    // Allocate a list of particles
    const _particle_list = new Array(part_count);

    // Normalize the direction
    const _direction = glMatrix.vec3.create();
    glMatrix.vec3.normalize(_direction, direction);

    // The ring is normal to the direction
    const radius_vect = get_perp_vector(_direction);
    glMatrix.vec3.scale(radius_vect, radius_vect, ring_radius);

    // Buffer vectors
    const vel = glMatrix.vec3.create();
    const pos = glMatrix.vec3.create();
    const rad = glMatrix.vec3.create();
    const quat = glMatrix.quat.create();

    // Create the particles
    for (let p = 0; p < part_count; p++) {
        // Compute rotation for this particle
        glMatrix.quat.setAxisAngle(quat, _direction, 2 * Math.PI * p / part_count);

        // Compute the velocity for particles in this ring
        glMatrix.vec3.copy(vel, _direction);
        glMatrix.vec3.scale(vel, vel, _velocity_max * Math.random());

        // Add a radial component to velocity
        glMatrix.vec3.copy(rad, radius_vect);
        glMatrix.vec3.normalize(rad, rad);
        glMatrix.vec3.scale(rad, rad, (9 * Math.random() - 1) / 8 * _lateral_velocity);
        glMatrix.vec3.transformQuat(rad, rad, quat);
        glMatrix.vec3.add(vel, vel, rad);

        // Compute the particle position
        glMatrix.vec3.copy(pos, ring_center);
        glMatrix.vec3.copy(rad, radius_vect);
        glMatrix.vec3.scale(rad, rad, 1 + (2 * Math.random() - 1) / 5.0);    // +/-10% of the radius is random
        glMatrix.vec3.transformQuat(rad, rad, quat);
        glMatrix.vec3.add(pos, pos, rad);

        // Random variations around the particle color
        const color = glMatrix.vec3.fromValues(
            part_color[0] + (2 * Math.random() - 1) * cvf,
            part_color[1] + (2 * Math.random() - 1) * cvf,
            part_color[2] + (2 * Math.random() - 1) * cvf,
        );

        // Create the particle (partially random duration)
        _particle_list[p] = make_particle(
            duration + (2 * Math.random() - 1),
            color,
            pos, vel, _acceleration
        );
    }

    return make_particle_system(gl, camera, _particle_list, particle_type, part_size);
}


/**
 * @param gl
 * @param camera
 * @param particle_type
 * @param from_pos:     Starting position of the flow line
 * @param to_pos:       Ending position of the flow line
 * @param direction:    Direction of the particle flow
 * @param lifetime:     Lifetime of the particles
 * @param ltv           Lifetime variance
 * @param part_count:   Number of particles
 * @param part_size:    Size of particles
 * @param part_color:   Base particles color
 * @param cvf:          Color variation factor (random variation range around particles color)
 * @param _velocity_max
 * @param _acceleration
 * @param _lateral_velocity
 */
const make_particle_flow = async function (
    gl, camera,
    particle_type,
    from_pos, to_pos, direction,
    lifetime, ltv,
    part_count, part_size,
    part_color, cvf,
    _velocity_max, _acceleration, _lateral_velocity
) {
    // Allocate a list of particles
    const _particle_list = new Array(part_count);

    // Normalize the direction
    const _direction = glMatrix.vec3.create();
    glMatrix.vec3.normalize(_direction, direction);

    // Normal vector in axial direction
    const axial_vect = glMatrix.vec3.create();
    glMatrix.vec3.sub(axial_vect, to_pos, from_pos);
    const axial_length = glMatrix.vec3.len(axial_vect);
    glMatrix.vec3.normalize(axial_vect, axial_vect);

    // Vector orthogonal to axis and direction
    const side_vect = glMatrix.vec3.create();
    glMatrix.vec3.cross(side_vect, axial_vect, _direction);

    // Buffer vectors
    const vel = glMatrix.vec3.create();
    const pos = glMatrix.vec3.create();
    const side = glMatrix.vec3.create();

    // Create the particles
    for (let p = 0; p < part_count; p++) {
        _particle_list[p] = generate_particle();
    }

    function generate_particle() {
        // Position along the axis
        glMatrix.vec3.scale(pos, axial_vect, axial_length * Math.random());
        glMatrix.vec3.add(pos, pos, from_pos);

        // Compute the velocity for particles in this ring
        glMatrix.vec3.copy(vel, _direction);
        glMatrix.vec3.scale(vel, vel, _velocity_max * Math.random());

        // Add a side component to velocity
        glMatrix.vec3.copy(side, side_vect);
        glMatrix.vec3.scale(side, side, (2 * Math.random() - 1) * _lateral_velocity);
        glMatrix.vec3.add(vel, vel, side);

        // Random variations around the particle color
        const color = glMatrix.vec3.fromValues(
            part_color[0] + (2 * Math.random() - 1) * cvf,
            part_color[1] + (2 * Math.random() - 1) * cvf,
            part_color[2] + (2 * Math.random() - 1) * cvf,
        );

        // Create the particle (partially random duration)
        return make_particle(
            lifetime + (2 * Math.random() - 1) * ltv,
            color,
            pos, vel, _acceleration
        );
    }

    return make_particle_system(gl, camera, _particle_list, particle_type, part_size, generate_particle);
}


const make_particle_system = async function (gl, camera, _particle_list, particle_type, particle_size, regenerate) {
    // Flag if regeneration is enabled
    const _regeneration_enabled = typeof (regenerate) === "function";

    // Get the particle count
    const _part_count = _particle_list.length;

    // Particles properties buffers
    const _particles_position_buffer = new Float32Array(3 * _part_count);
    const _particles_lifetime_buffer = new Float32Array(_part_count);
    const _particles_color_buffer = new Float32Array(3 * _part_count);

    // GL buffers
    const _vertex_buffer   = gl.createBuffer();
    const _position_buffer = gl.createBuffer();
    const _lifetime_buffer = gl.createBuffer();
    const _color_buffer    = gl.createBuffer();

    // Load mesh
    const _mesh = await load_mesh('objects/plane_face.obj', true, particle_size);

    // Flag to indicate if this particle set is stopped
    let _stopped = false;

    // Initialize GL buffers
    // Mesh's vertices buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, _vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, _mesh.buffer, gl.STATIC_DRAW);

    function cmp_particle_dist(p1, p2) {
        const dist1 = glMatrix.vec3.dist(p1.get_position(), camera.get_position());
        const dist2 = glMatrix.vec3.dist(p2.get_position(), camera.get_position());

        if (dist1 < dist2)
            return 1;
        else if (dist1 > dist2)
            return -1;
        else
            return 0;
    }
    
    function fill_particle_buffers() {
        // Sort particles (the farthest first)
        _particle_list.sort(cmp_particle_dist);

        // Count the number of particles in the buffer
        let i = 0;
        for (const particle of _particle_list) {
            // Skip dead particles
            if (particle.is_alive()) {
                // Put particle's position into buffer
                const pos = particle.get_position();
                _particles_position_buffer[i*3]     = pos[0];
                _particles_position_buffer[i*3 + 1] = pos[1];
                _particles_position_buffer[i*3 + 2] = pos[2];

                // Put particle's life factor into buffer
                _particles_lifetime_buffer[i] = particle.get_life() / particle.get_lifetime();

                // Put particle's color into buffer
                _particles_color_buffer[i*3]     = particle.color[0];
                _particles_color_buffer[i*3 + 1] = particle.color[1];
                _particles_color_buffer[i*3 + 2] = particle.color[2];

                // Increment the size of buffer (in # particles)
                i++;
            }
        }

        // Return the total number of alive particles
        return i;
    }

    function update(dt) {
        // Update all (alive) particles
        for (let i = 0; i < _part_count; i++) {
            const particle = _particle_list[i];
            if (particle.is_alive()) {
                particle.update(dt);
            } else if (_regeneration_enabled) {
                _particle_list[i] = regenerate();
            }
        }
    }

    const sizeofFloat = Float32Array.BYTES_PER_ELEMENT;
    function draw(shader) {
        // Update particles position buffer
        const num_alive_particles = fill_particle_buffers();

        if (num_alive_particles === 0 && !_regeneration_enabled) {
            _stopped = true;
            return;
        }

        const u_particle_type = gl.getUniformLocation(shader.program, 'u_particle_type');
        gl.uniform1i(u_particle_type, particle_type);

        // Use mesh buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, _vertex_buffer);

        // Send mesh buffers to shader (vertices and textures, we don't need normals)
        const a_vertex = gl.getAttribLocation(shader.program, 'a_vertex');
        if (a_vertex >= 0) {
            gl.enableVertexAttribArray(a_vertex);
            gl.vertexAttribPointer(a_vertex, 3, gl.FLOAT, false, _mesh.vert_length * sizeofFloat, 0);
            gl.vertexAttribDivisor(a_vertex, 0);    // Repeat the vertex for each instance
        }

        // Send texture coordinates to shader
        const a_texcoord = gl.getAttribLocation(shader.program, 'a_texcoord');
        if (a_texcoord >= 0) {
            gl.enableVertexAttribArray(a_texcoord);
            gl.vertexAttribPointer(a_texcoord, 2, gl.FLOAT, false, _mesh.vert_length * sizeofFloat, 3 * sizeofFloat);
            gl.vertexAttribDivisor(a_texcoord, 0);  // Repeat the texture coordinates for each instance
        }

        // Use position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, _position_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, _particles_position_buffer, gl.DYNAMIC_DRAW);

        const a_position = gl.getAttribLocation(shader.program, 'a_position');
        if (a_position >= 0) {
            gl.enableVertexAttribArray(a_position);
            gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 3 * sizeofFloat, 0);
            gl.vertexAttribDivisor(a_position, 1);  // Each instance has its own position
        }

        // Use lifetime buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, _lifetime_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, _particles_lifetime_buffer, gl.DYNAMIC_DRAW);

        const a_life_factor = gl.getAttribLocation(shader.program, 'a_life_factor');
        if (a_life_factor >= 0) {
            gl.enableVertexAttribArray(a_life_factor);
            gl.vertexAttribPointer(a_life_factor, 1, gl.FLOAT, false, sizeofFloat, 0);
            gl.vertexAttribDivisor(a_life_factor, 1);  // Each instance has its own life factor
        }

        // Use color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, _color_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, _particles_color_buffer, gl.DYNAMIC_DRAW);

        const a_color = gl.getAttribLocation(shader.program, 'a_color');
        if (a_color >= 0) {
            gl.enableVertexAttribArray(a_color);
            gl.vertexAttribPointer(a_color, 3, gl.FLOAT, false, 3 * sizeofFloat, 0);
            gl.vertexAttribDivisor(a_color, 1);  // Each instance has its own position
        }

        // Draw instances
        gl.drawArraysInstanced(gl.TRIANGLES, 0, _mesh.num_vertices, num_alive_particles);

        // We MUST restore these parameters to 0 after drawing...
        gl.vertexAttribDivisor(a_position, 0);
        gl.vertexAttribDivisor(a_life_factor, 0);
        gl.vertexAttribDivisor(a_color, 0);
    }

    function is_stopped() {
        return _stopped;
    }

    return {
        update: update,
        draw: draw,
        is_stopped: is_stopped,
    }
}

const make_particles_engine = function (gl, camera) {
    // List of all active particle systems
    const _particle_system_list = [];

    function register_particle_system(particle_system_promise) {
        // Ensure we waited for the promise before adding it to the list
        particle_system_promise.then(p_sys => _particle_system_list.push(p_sys));
    }

    function update(dt) {
        // Update all particle systems
        for (const p_system of _particle_system_list) {
            if (!p_system.is_stopped()) {
                // Update the particle system if it is not stopped
                p_system.update(dt);
            }
            else {
                // If the system is stopped -> remove it from list
                const idx = _particle_system_list.indexOf(p_system);
                if (idx > -1) {
                    _particle_system_list.splice(idx, 1);
                }
            }
        }
    }

    function draw(shader) {
        // We need to send the inverse of the view matrix rotation such that the faces remain in front of the camera
        const u_iV_rot = gl.getUniformLocation(shader.program, 'iV_rot');
        const cam_rot = glMatrix.quat.create();
        const iV_rot = glMatrix.mat4.create();
        glMatrix.mat4.getRotation(cam_rot, camera.get_view_matrix());
        glMatrix.mat4.fromQuat(iV_rot, cam_rot);
        glMatrix.mat4.invert(iV_rot, iV_rot);
        gl.uniformMatrix4fv(u_iV_rot, false, iV_rot);

        // Draw all particle systems
        for (const p_system of _particle_system_list) {
            p_system.draw(shader);
        }
    }

    return {
        register_particle_system: register_particle_system,
        update: update,
        draw: draw
    }
}