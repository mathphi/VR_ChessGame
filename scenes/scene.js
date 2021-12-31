async function make_scene(name, gl, camera, chessboard, physics_engine, light_set) {

    switch(name){
        case 'evening_lights':
            return make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set);
        case 'niagara_falls':
            return make_niagara_falls_scene(gl, camera, chessboard, physics_engine, light_set);
        default:
            return make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set);
    }

}

async function make_niagara_falls_scene(gl, camer, chessboard, physics_engine, light_set){


    return{
        draw:draw,
        draw_cubemap:draw_cubemap,
        animate:animate,
    }
}

