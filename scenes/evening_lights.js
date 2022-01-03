async function make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set){
    const keys_cam_settings = {
        0: {zenith: 60.0, azimuth: 240.0, radius: 55.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 0
        1: {zenith: 45.0, azimuth: 135.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 1
        2: {zenith: 45.0, azimuth: 180.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 2
        3: {zenith: 45.0, azimuth: 225.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 3
        4: {zenith: 45.0, azimuth: 90.0,  radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 4
        5: {zenith: 0.0,  azimuth: 0.0,   radius: 16.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 5
        6: {zenith: 45.0, azimuth: 270.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 6
        7: {zenith: 45.0, azimuth: 45.0,  radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 7
        8: {zenith: 45.0, azimuth: 0.0,   radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 8
        9: {zenith: 45.0, azimuth: 315.0, radius: 33.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)},  // 9
    [' ']: {zenith: 0.0,  azimuth: 0.0,   radius: 16.0, center: glMatrix.vec3.fromValues(0.0, -4.0, 0.0)}
    };

    // Setup scene-specific camera shortcuts
    for (const [key, orient] of Object.entries(keys_cam_settings)) {
        camera.set_key_camera_view(key, orient.zenith, orient.azimuth, orient.radius, orient.center);
    }

    // CUBEMAP
    const cubemap = await make_cubemap(gl, 'objects/misc/cube.obj', 'textures/cubemaps/Nalovardo', 1024);

    // TEXTURES
    const table_tex = await load_texture(gl, 'textures/Wood.jpg', true);
    const ch_clk_tex = await load_texture(gl, 'textures/ch_clock_tex.png', true);
    const lamp_table_tex = await load_texture(gl, 'textures/lamp_table_tex.jpg', true);
    const plant_tex = await load_texture(gl, 'textures/plant_tex.jpg', true);

    // BUMP MAPS
    const table_bm = await load_texture(gl, 'textures/WoodBumpMap.jpg', true);
    const lamp_table_bm = await load_texture(gl, 'textures/lamp_table_bm.jpg', true);
    const plant_bm = await load_texture(gl, 'textures/plant_bm.jpg', true);

    // OBJECTS
    // Loading objects from files
    const glass_mesh = await load_obj('objects/misc/glass.obj', false);
    const table_mesh = await load_obj('objects/misc/table.obj', true);
    const lamp_mesh = await load_obj('objects/misc/lamp.obj', false, glMatrix.vec3.fromValues(20.0, 20.0, 20.0));
    const lamp_table_mesh = await load_obj('objects/misc/lamp_table.obj', true);
    const ch_clk_mesh = await load_obj('objects/misc/ch_clock.obj', true);
    const ch_clk_hand_mesh = await load_obj('objects/misc/ch_clock_hand.obj', false, glMatrix.vec3.fromValues(1.5, 1.5, 1.5));
    const ch_clk_sec_hand_mesh = await load_obj('objects/misc/clock_sec.obj', false, glMatrix.vec3.fromValues(0.7, 0.7, 0.7));
    const plant_mesh = await load_obj('objects/misc/plant.obj', true, glMatrix.vec3.fromValues(3.0, 3.0, 3.0));

    // Make the buffer and the functions to draw the objects
    const glass_obj = make_object(gl, glass_mesh);
    const table_obj = make_object(gl, table_mesh, table_tex, table_bm);
    const lamp_obj = make_object(gl, lamp_mesh);
    const lamp_table_obj = make_object(gl, lamp_table_mesh, lamp_table_tex, lamp_table_bm);
    const ch_clk_obj = make_object(gl, ch_clk_mesh, ch_clk_tex, null);
    const ch_clk_hand_l_obj = make_object(gl, ch_clk_hand_mesh);
    const ch_clk_hand_r_obj = make_object(gl, ch_clk_hand_mesh);
    const ch_clk_sec_hand_l_obj = make_object(gl, ch_clk_sec_hand_mesh);
    const ch_clk_sec_hand_r_obj = make_object(gl, ch_clk_sec_hand_mesh);
    const plant_obj = make_object(gl, plant_mesh, plant_tex, plant_bm);

    // COLLISION BOXES
    const c_ch_clk_mesh = await load_obj('objects/collision_boxes/c_ch_clock.obj', false);
    const c_lamp_table_mesh = await load_obj('objects/collision_boxes/c_lamp_table.obj', false);
    
    // LIGHTS
    // Point Lights
    const orange_pl = light_set.add_point_light(
        glMatrix.vec3.fromValues(0.0, 22.0, -50.0),
        glMatrix.vec3.fromValues(5.0, 2.5, 0.0));

    const yellow_pl = light_set.add_point_light(
        glMatrix.vec3.fromValues(0.0, 20.0, 50.0),
        glMatrix.vec3.fromValues(1.0, 1.0, 0.5));
    // Spotlights
    const lamp_sl = light_set.add_spot_light(
        glMatrix.vec3.fromValues(10.0, 7.0, 15.0),
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        glMatrix.vec3.fromValues(0.0, -1.0, 0.0),
        20,
        180
    );

    // OBJECTS PHYSICS
    physics_engine.register_object(table_obj, 0.0);
    physics_engine.register_object(glass_obj, 1.0);
    physics_engine.register_object(ch_clk_obj, 0.0, c_ch_clk_mesh);
    physics_engine.register_object(ch_clk_hand_l_obj, 0.0);
    physics_engine.register_object(ch_clk_hand_r_obj, 0.0);
    physics_engine.register_object(ch_clk_sec_hand_l_obj, 0.0);
    physics_engine.register_object(ch_clk_sec_hand_r_obj, 0.0);
    physics_engine.register_object(lamp_table_obj, 0.0, c_lamp_table_mesh);
    physics_engine.register_object(plant_obj, 0.0);

    // Set initial object position, etc
    reset(0.0);

    function reset(anim_duration = 0.0) {
        // Positioning of the objects
        glass_obj.anim_to_position(glMatrix.vec3.fromValues(-10.0, 1.0, 18.0), anim_duration);
        table_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -5.0, 0.0), anim_duration);
        lamp_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -40.0, -50.0), anim_duration);
        lamp_table_obj.anim_to_position(glMatrix.vec3.fromValues(10.0, -5.0, 15.0), anim_duration);
        ch_clk_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -5.0, -12.0), anim_duration);
        ch_clk_hand_l_obj.anim_to_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7), anim_duration);
        ch_clk_hand_r_obj.anim_to_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7), anim_duration);
        ch_clk_sec_hand_l_obj.anim_to_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7), anim_duration);
        ch_clk_sec_hand_r_obj.anim_to_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7), anim_duration);
        plant_obj.anim_to_position(glMatrix.vec3.fromValues(10.0, -5.0, -22.0), anim_duration);

        // Positioning of the chessboard
        const chessboard_rotation = glMatrix.quat.create();
        glMatrix.quat.rotateY(chessboard_rotation, chessboard_rotation, Math.PI / 2.0);
        chessboard.anim_to_position(glMatrix.vec3.fromValues(0.0, -5.0, 0.0), anim_duration, anim_duration === 0.0);
        chessboard.anim_to_rotation(chessboard_rotation, anim_duration, anim_duration === 0.0);
        chessboard.force_phycics(false);

        const zero_rotation = glMatrix.quat.create();

        // Reset orientation
        glass_obj.anim_to_rotation(zero_rotation, anim_duration);
        table_obj.anim_to_rotation(zero_rotation, anim_duration);
        lamp_obj.anim_to_rotation(zero_rotation, anim_duration);
        lamp_table_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_hand_l_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_hand_r_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_sec_hand_l_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_sec_hand_r_obj.anim_to_rotation(zero_rotation, anim_duration);
        plant_obj.anim_to_rotation(zero_rotation, anim_duration);

        // Reset physics mass
        table_obj.set_physics_mass(0.0);
        glass_obj.set_physics_mass(1.0);
        ch_clk_obj.set_physics_mass(0.0);
        ch_clk_hand_l_obj.set_physics_mass(0.0);
        ch_clk_hand_r_obj.set_physics_mass(0.0);
        ch_clk_sec_hand_l_obj.set_physics_mass(0.0);
        ch_clk_sec_hand_r_obj.set_physics_mass(0.0);
        lamp_table_obj.set_physics_mass(0.0);
        plant_obj.set_physics_mass(0.0);
    }

    let _current_turn = chessboard.get_turn();
    function set_current_turn(turn){
        _current_turn = turn;

        // Change keyboard shortcut 5 as a function of the player
        camera.set_key_camera_view(
            5,
            1.0,
            turn === 'w' ? 180.0 : 0.0,
            16.0,
            glMatrix.vec3.fromValues(0.0, 0.0, 0.0)
        );
        camera.set_key_camera_view(
            ' ',
            1.0,
            turn === 'w' ? 180.0 : 0.0,
            16.0,
            glMatrix.vec3.fromValues(0.0, 0.0, 0.0)
        );
    }

    let _game_stopped = false;
    function on_game_event(event) {
        _game_stopped = !!(event & ChessSituation.GameOver);
    }

    const z_axis = glMatrix.vec3.fromValues(0.0, 0.0, 1.0);

    function animate(time, delta_time) {
        // Animate clock hands
        if (_current_turn === 'w' && !_game_stopped) {
            ch_clk_hand_l_obj.rotate(z_axis, 6*delta_time / (60*1000*180) * Math.PI);
            ch_clk_sec_hand_l_obj.rotate(z_axis, 6*delta_time / (1000*180) * Math.PI);
        }
        else if (!_game_stopped) {
            ch_clk_hand_r_obj.rotate(z_axis, 6*delta_time / (60*1000*180)  * Math.PI);
            ch_clk_sec_hand_r_obj.rotate(z_axis, 6*delta_time / (1000*180) * Math.PI);
        }

        // Draw loop
        gl.clearColor(0.2, 0.2, 0.2, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Animate the spotlight
        const light_int = (
            Math.sin(2.0 * Math.PI / (3.0 + 0.05*Math.random()) * time/1000.0 ) + 
            Math.sin(2.0 * Math.PI /10.0 * time/1000.0 )
            ) / 2.0;
            
        light_set.set_light_color(orange_pl, 
            glMatrix.vec3.fromValues(5.0 + light_int, 2.5+0.5*light_int, 0.0)
        );
    }

    function draw_cubemap(shader){
        cubemap.draw(shader);
    }

    function draw(shader){
        // Give cubemap textures (for reflection/refraction)
        cubemap.activate(shader);

        // Draw objects
        glass_obj.draw(shader);
        table_obj.draw(shader);
        lamp_obj.draw(shader);
        lamp_table_obj.draw(shader);
        ch_clk_obj.draw(shader);
        ch_clk_hand_l_obj.draw(shader);
        ch_clk_hand_r_obj.draw(shader);
        ch_clk_sec_hand_l_obj.draw(shader);
        ch_clk_sec_hand_r_obj.draw(shader);
        plant_obj.draw(shader);
    }

    function force_physics(force) {
        lamp_table_obj.get_physics_body().set_mass(force ? 2.0 : 0.0);
        ch_clk_obj.get_physics_body().set_mass(force ? 2.0 : 0.0);
        ch_clk_hand_l_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_hand_r_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_sec_hand_l_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_sec_hand_r_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        plant_obj.get_physics_body().set_mass(force ? 2.0 : 0.0);
    }


    return{
        animate: animate,
        draw_cubemap: draw_cubemap,
        draw: draw,
        set_current_turn: set_current_turn,
        table: table_obj,
        force_physics: force_physics,
        reset: reset,
        on_game_event: on_game_event
    }
}

