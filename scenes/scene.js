async function make_scene(name, gl, camera, chessboard, physics_engine, light_set, particle_engine) {

    switch(name){
        case 'evening_lights':
            return make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set, particle_engine);
        case 'niagara_falls':
            return make_niagara_falls_scene(gl, camera, chessboard, physics_engine, light_set, particle_engine);
        case 'cosy_interior':
            return make_cosy_interior_scene(gl, camera, chessboard, physics_engine, light_set, particle_engine);
        default:
            return make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set, particle_engine);
    }

}

async function make_niagara_falls_scene(gl, camer, chessboard, physics_engine, light_set, particle_engine){


    return{
        draw: draw,
        draw_cubemap: draw_cubemap,
        animate: animate,
        table: table,
        force_physics: force_physics,
    }
}

