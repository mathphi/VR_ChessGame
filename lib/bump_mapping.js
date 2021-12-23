const object_tangent_space = function(obj) {
    // Tangents list (1-1 matching with vertices list)
    let tangent_space = [];

    // Each vertex uses 8 floats (3 position, 2 texture, 3 normal)
    const vertex_length = 8;

    function get_vert_pos(buf, vert_idx) {
        return glMatrix.vec3.fromValues(
            buf[vert_idx * vertex_length],
            buf[vert_idx * vertex_length + 1],
            buf[vert_idx * vertex_length + 2]
        );
    }
    function get_vert_tex(buf, vert_idx) {
        return glMatrix.vec2.fromValues(
            buf[vert_idx * vertex_length + 3],
            buf[vert_idx * vertex_length + 4]
        );
    }

    // Construct tangent and bi-tangent buffers
    // The loop step is 3 since we compute tangent and bi-tangent once for
    // each triangle (each made of 3 vertices).
    for (let i = 0 ; i < obj.buffer.length/vertex_length ; i += 3) {
        // "For each triangle of the mesh"
        const pos1 = get_vert_pos(obj.buffer, i);
        const pos2 = get_vert_pos(obj.buffer, i+1);
        const pos3 = get_vert_pos(obj.buffer, i+2);

        const uv1 = get_vert_tex(obj.buffer, i);
        const uv2 = get_vert_tex(obj.buffer, i+1);
        const uv3 = get_vert_tex(obj.buffer, i+2);

        const edge1 = glMatrix.vec3.create();
        const edge2 = glMatrix.vec3.create();
        glMatrix.vec3.sub(edge1, pos2, pos1);
        glMatrix.vec3.sub(edge2, pos3, pos1);

        const delta_uv1 = glMatrix.vec2.create();
        const delta_uv2 = glMatrix.vec2.create();
        glMatrix.vec2.sub(delta_uv1, uv2, uv1);
        glMatrix.vec2.sub(delta_uv2, uv3, uv1);

        const f = 1.0 / (delta_uv1[0] * delta_uv2[1] - delta_uv2[0] * delta_uv1[1]);

        const tangent = glMatrix.vec3.fromValues(
            f * (delta_uv2[1] * edge1[0] - delta_uv1[1] * edge2[0]),
            f * (delta_uv2[1] * edge1[1] - delta_uv1[1] * edge2[1]),
            f * (delta_uv2[1] * edge1[2] - delta_uv1[1] * edge2[2])
        );

        const bitangent = glMatrix.vec3.fromValues(
            f * (-delta_uv2[0] * edge1[0] + delta_uv1[0] * edge2[0]),
            f * (-delta_uv2[0] * edge1[1] + delta_uv1[0] * edge2[1]),
            f * (-delta_uv2[0] * edge1[2] + delta_uv1[0] * edge2[2])
        );

        // Repeat 3 times the same vector (it is the same for the 3 vertices of each triangle)
        for (let k = 0 ; k < 3 ; k++) {
            Array.prototype.push.apply(
                tangent_space, tangent
            );
            Array.prototype.push.apply(
                tangent_space, bitangent
            );
        }
    }

    return new Float32Array(tangent_space);
}
