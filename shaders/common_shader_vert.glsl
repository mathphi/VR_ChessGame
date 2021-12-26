attribute vec3 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_normal;
attribute vec3 a_tangent;
attribute vec3 a_bitangent;

// Mesh data
varying vec3 v_normal;
varying vec3 v_frag_coord;
varying mat3 v_TBN;
varying vec2 v_texcoord;

uniform mat4 M;
uniform mat4 itM;   // Inverse transpose model
uniform mat4 V;
uniform mat4 P;

uniform bool u_has_bumpmap;

void main() {
    // Apply model, view and projection to vertex position
    vec4 frag_coord = M*vec4(a_position, 1.0);
    gl_Position = P*V*frag_coord;

    // Transform the normals according to the model matrix
    v_normal = vec3(itM * vec4(a_normal, 1.0));

    // Compute TBN space only in case of bump-mapped object
    if (u_has_bumpmap) {
        // Compute the TBN space for this vertex
        vec3 T = normalize(vec3(M * vec4(a_tangent,   0.0)));
        vec3 B = normalize(vec3(M * vec4(a_bitangent, 0.0)));
        vec3 N = normalize(v_normal);
        v_TBN = mat3(T, B, N);
    }

    v_texcoord    = a_texcoord;
    v_frag_coord  = frag_coord.xyz;
}