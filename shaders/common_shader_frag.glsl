#define MAX_LIGHTS_COUNT 10
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_SPOT  1

precision mediump float;
varying vec3 v_normal;
varying vec3 v_frag_coord;
varying mat3 v_TBN;
varying vec2 v_texcoord;

uniform int u_lights_count;
uniform int u_lights_type[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_position[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_color[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_direction[MAX_LIGHTS_COUNT];
uniform float u_lights_in_angle[MAX_LIGHTS_COUNT];
uniform float u_lights_out_angle[MAX_LIGHTS_COUNT];
uniform vec3 u_cam_pos;

uniform bool u_has_texture;
uniform bool u_has_bumpmap;
uniform sampler2D u_texture;
uniform sampler2D u_bump_map;

float strict_map(float value, float min_x, float max_x, float min_y, float max_y) {
    return max(min_y, min(max_y,
        min_y + (value - min_x) * (max_y - min_y) / (max_x - min_x)
    ));
}

void main() {
    // Check is we must apply a bump map
    vec3 normal;
    if (u_has_bumpmap) {
        normal = texture2D(u_bump_map, vec2(v_texcoord.x, 1.0-v_texcoord.y)).rgb;
        normal = normal * 2.0 - 1.0;    // From color space to normal space
        normal = normalize(v_TBN * normal);
    }
    else {
        normal = normalize(v_normal);
    }

    // Ambient
    float ambient = 0.1;

    // Light contribution
    vec3 light = vec3(0);

    // For each light
    for (int i = 0 ; i < MAX_LIGHTS_COUNT ; i++) {
        // Needed to exit the loop since loop condition must depend
        // on constant variables only!
        if (i >= u_lights_count) {
            break;
        }

        int light_type = u_lights_type[i];              // Light type
        vec3 light_color = u_lights_color[i];           // Light color
        vec3 light_position = u_lights_position[i];     // Light position
        vec3 light_direction = u_lights_direction[i];   // Light direction
        float light_inner_angle = u_lights_in_angle[i]; // Light inner angle
        float light_outer_angle = u_lights_out_angle[i];// Light outer angle

        // Light vector to fragment
        vec3 L = normalize(light_position - v_frag_coord);

        // Diffuse
        float diffusion = max(0.0, dot(normal, L));

        // Specular
        float spec_strength = 0.8;
        vec3 view_dir = normalize(u_cam_pos - v_frag_coord);
        vec3 reflect_dir = reflect(-L, normal);
        float spec = pow(max(dot(view_dir, reflect_dir), 0.0), 32.0);
        float specular = spec_strength * spec;

        // Directional attenuation (for directional light)
        float direction_att = 1.0;

        // If this light is directional
        if (light_type == LIGHT_TYPE_SPOT) {
            float angle = acos(dot(-L, light_direction));

            direction_att = strict_map(
                angle,
                light_outer_angle, light_inner_angle,
                0.0, 1.0
            );
        }

        light += (specular + diffusion) * light_color * direction_att;
    }

    vec4 color = vec4(1.0);

    // If we must paint with a texture...
    if (u_has_texture) {
        color = texture2D(u_texture, vec2(v_texcoord.x, 1.0-v_texcoord.y));
    }

    gl_FragColor = color * vec4(ambient + light, 1.0);
}