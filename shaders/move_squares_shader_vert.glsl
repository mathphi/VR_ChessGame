attribute vec3 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_normal;

// Mesh data
varying vec3 v_normal;
varying vec3 v_frag_coord;
varying vec2 v_texcoord;

uniform mat4 M;
uniform mat4 itM;   // Inverse transpose model
uniform mat4 V;
uniform mat4 P;

void main() {
    // Apply model, view and projection to vertex position
    vec4 frag_coord = M*vec4(a_position, 1.0);
    gl_Position = P*V*frag_coord;

    // Transform the normals according to the model matrix
    v_normal = vec3(itM * vec4(a_normal, 1.0));

    v_frag_coord  = frag_coord.xyz;
}