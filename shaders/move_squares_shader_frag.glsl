precision mediump float;

// Mesh data
varying vec3 v_normal;
varying vec3 v_frag_coord;
varying vec2 v_texcoord;

// Material properties
uniform vec3 u_object_color;

void main() {
    gl_FragColor = vec4(u_object_color, 1.0);
}