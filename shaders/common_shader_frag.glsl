#define MAX_LIGHTS_COUNT 10
#define LIGHT_TYPE_POINT 0
#define LIGHT_TYPE_SPOT  1

precision mediump float;

// Mesh data
varying vec3 v_normal;
varying vec3 v_frag_coord;
varying mat3 v_TBN;
varying vec2 v_texcoord;

// Light uniforms
uniform int u_lights_count;
uniform int u_lights_type[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_position[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_color[MAX_LIGHTS_COUNT];
uniform vec3 u_lights_direction[MAX_LIGHTS_COUNT];
uniform float u_lights_in_angle[MAX_LIGHTS_COUNT];
uniform float u_lights_out_angle[MAX_LIGHTS_COUNT];

// Material properties
uniform vec3 u_object_color;
uniform float u_specular_exp;
uniform float u_specular_strength;
uniform float u_reflect_strength;
uniform float u_refract_strength;
uniform float u_refract_index;

// Camera position
uniform vec3 u_cam_pos;

// Textures and bumpmap uniforms
uniform bool u_has_texture;
uniform bool u_has_bumpmap;
uniform sampler2D u_texture;
uniform sampler2D u_bump_map;
uniform samplerCube u_cubemap;

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
    vec3 light_diff = vec3(0);  // Diffusion
    vec3 light_spec = vec3(0);  // Specular

    // Ray from camera to object
    vec3 camera_ray = normalize(v_frag_coord - u_cam_pos);

    // Compute light equation for each light
    for (int i = 0 ; i < MAX_LIGHTS_COUNT ; i++) {
        // This condition and break are needed to exit the loop since the
        // loop condition must depend on constant variables only!
        if (i >= u_lights_count) {
            break;
        }

        // Retreive this light parameters
        int light_type = u_lights_type[i];                  // Light type
        vec3 light_color = u_lights_color[i];               // Light color
        vec3 light_position = u_lights_position[i];         // Light position
        vec3 light_direction = u_lights_direction[i];       // Light direction
        float light_inner_angle = u_lights_in_angle[i];     // Light inner angle
        float light_outer_angle = u_lights_out_angle[i];    // Light outer angle

        // Light vector to fragment
        vec3 L = normalize(light_position - v_frag_coord);

        // Diffuse
        float diffusion = max(0.0, dot(normal, L));

        // Specular
        vec3 light_refl_dir = reflect(-L, normal);
        float spec_comp = pow(max(dot(-camera_ray, light_refl_dir), 0.0), u_specular_exp);
        float specular = u_specular_strength * spec_comp;

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

        light_diff += diffusion * light_color * direction_att;
        light_spec += specular * light_color * direction_att;
    }

    // Intrinsic object color
    vec4 object_color = vec4(u_object_color, 1.0);

    // If we must paint with a texture...
    if (u_has_texture) {
        object_color = texture2D(u_texture, vec2(v_texcoord.x, 1.0-v_texcoord.y));
    }

    // Total fragment color depends on light
    vec4 total_color = object_color * vec4(ambient + light_diff, 1.0) + vec4(light_spec, 1.0);

    // Reflection of cubemap on object
    if (u_reflect_strength > 0.0) {
        vec3 reflect_ray = reflect(camera_ray, normal);
        vec4 cubemap_color = textureCube(u_cubemap, reflect_ray);
        total_color = (1.0 - u_reflect_strength) * total_color + u_reflect_strength * cubemap_color;
    }

    // Refraction of cubemap in object
    if (u_refract_strength > 0.0) {
        float refract_ratio = 1.00 / u_refract_index;
        vec3 refract_ray = refract(camera_ray, normal, refract_ratio);
        vec4 cubemap_color = textureCube(u_cubemap, refract_ray);
        total_color = (1.0 - u_refract_strength) * total_color + u_refract_strength * cubemap_color;
    }

    gl_FragColor = total_color;
}