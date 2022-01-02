attribute vec3 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_normal;

varying vec3 v_texcoord;
varying vec3 v_normal;

uniform mat4 M;
uniform mat4 itM;
uniform mat4 V;
uniform mat4 P;

void main() {
    // We do NOT multiply by the model as the cubemap should not move
    // with the camera.
    // We keep only the rotation from the View matrix
    mat3 Vrotation = mat3(V);
    vec4 frag_coord = vec4(a_position, 1.0);
    // The positions xyz are divided by w after the vertex shader.
    // The z component is equal to the depth value.
    // We want a z (depth) always equal to 1.0 here, so we set z = w.
    // Remember: z=1.0 is the MAXIMUM depth value.
    gl_Position = (P*mat4(Vrotation)*frag_coord).xyww;

    // We set the texture coordinates accordingly to the position.
    v_texcoord = frag_coord.xyz;
    v_normal = a_normal;
}