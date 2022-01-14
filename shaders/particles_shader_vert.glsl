attribute vec3 a_vertex;
attribute vec3 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_color;
attribute float  a_life_factor;

varying vec3 v_frag_coord;
varying vec2 v_texcoord;
varying vec3 v_particle_color;
varying float v_life_factor;

uniform mat4 V;
uniform mat4 iV_rot;
uniform mat4 P;

void main() {
    // We want the mesh face always in front of the camera.
    // Rotate the vertices by the inverse of the view matrix rotation.
    vec4 rot_vertex = iV_rot * vec4(a_vertex, 1.0);

    // Apply particle position
    vec4 frag_coord = vec4(a_position, 0.0) + rot_vertex;

    // Apply projection and view transforms
    gl_Position = P*V*frag_coord;

    v_texcoord = a_texcoord;
    v_frag_coord  = frag_coord.xyz;
    v_life_factor = a_life_factor;
    v_particle_color = a_color;
}