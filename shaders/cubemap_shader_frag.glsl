precision mediump float;
varying vec3 v_texcoord;

// We have a samplerCube this time (not a 2D texture)
uniform samplerCube u_cubemap;

void main() {
    // We sample the cube at the position of the vertices
    gl_FragColor = textureCube(u_cubemap, v_texcoord);
}