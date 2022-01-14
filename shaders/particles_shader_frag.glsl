precision mediump float;

#define PARTICLE_TYPE_STAR      1
#define PARTICLE_TYPE_SPHERE    2

varying vec3 v_frag_coord;
varying vec2 v_texcoord;
varying vec3 v_particle_color;
varying float v_life_factor;

uniform int u_particle_type;

void main()
{
    if (u_particle_type == PARTICLE_TYPE_SPHERE) {
        // Compute the distance to the center
        float dist = distance(v_texcoord, vec2(0.5));

        // Color as a function of the distance
        gl_FragColor = vec4(v_particle_color, max(0.0, 1.0 - dist / 0.5) * v_life_factor);
    }
    else {
        // Texture coordinates centered and factor proportional to distance to X and Y axis
        float factor = 0.0;
        factor += pow(max(0.0, 1.0 - abs(v_texcoord.x*2.0 - 1.0)), 5.0) * 0.5;
        factor += pow(max(0.0, 1.0 - abs(v_texcoord.y*2.0 - 1.0)), 5.0) * 0.5;

        // Compute the distance to the center
        float dist = distance(v_texcoord, vec2(0.5));

        // The star is brighter at its center
        gl_FragColor = vec4(v_particle_color * (2.0 - dist / 0.5), factor * v_life_factor);
    }
} 