async function make_cosy_interior_scene(gl, camera, chessboard, physics_engine, light_set, particle_engine) {
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
    const cubemap = await make_cubemap(gl, 'objects/misc/cube.obj', 'textures/cubemaps/Forest2', 2048);

    // TEXTURES
    const table_tex = await load_texture(gl, 'textures/Wood.jpg', true);
    const ch_clk_tex = await load_texture(gl, 'textures/ch_clock_tex.png', true);
    const lamp_table_tex = await load_texture(gl, 'textures/lamp_table_tex.jpg', true);
    const plant_tex = await load_texture(gl, 'textures/plant_tex.jpg', true);
    const walls_tex = await load_texture(gl, 'textures/brick_walls_tex.jpg', false);
    const ground_tex = await load_texture(gl, 'textures/floor_tex.jpg', true);
    const door_tex = await load_texture(gl, 'textures/door_tex.jpg', false);
    const frame_tex = await load_texture(gl, 'textures/frame.jpg', false);

    // BUMP MAPS
    const table_bm = await load_texture(gl, 'textures/WoodBumpMap.jpg', true);
    const lamp_table_bm = await load_texture(gl, 'textures/lamp_table_bm.jpg', true);
    const plant_bm = await load_texture(gl, 'textures/plant_bm.jpg', true);
    const walls_bm = await load_texture(gl, 'textures/brick_walls_bm.jpg', true);
    const ground_bm = await load_texture(gl, 'textures/floor_bm.jpg', true);
    const ceiling_bm = await load_texture(gl, 'textures/ceiling_bm.jpg', true);
    const door_bm = await load_texture(gl, 'textures/door_bm.jpg', false);

    // MATERIALS
    const floor_material = make_material(
        'floor',
        glMatrix.vec3.fromValues(0.0, 0.0, 0.0),
        60.0, 1.0
    );

    const ceiling_material = make_material(
        'ceiling',
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        60.0, 0.0
    );

    // OBJECTS
    // Loading objects from files
    const glass_mesh = await load_mesh('objects/misc/glass.obj', false);
    const table_mesh = await load_mesh('objects/misc/table.obj', true);
    const lamp_mesh = await load_mesh('objects/misc/wall_lamp.obj', false, 50.0);
    const lamp_table_mesh = await load_mesh('objects/misc/lamp_table.obj', true);
    const ch_clk_mesh = await load_mesh('objects/misc/ch_clock.obj', true);
    const ch_clk_hand_mesh = await load_mesh('objects/misc/ch_clock_hand.obj', false, 1.5);
    const ch_clk_sec_hand_mesh = await load_mesh('objects/misc/clock_sec.obj', false, 0.7);
    const plant_mesh = await load_mesh('objects/misc/plant.obj', true, 3.0);
    const walls_mesh = await load_mesh('objects/misc/walls.obj', true, 1.0);
    const ground_mesh = await load_mesh('objects/misc/ground_plane.obj', true);
    const ceiling_mesh = await load_mesh('objects/misc/ground_plane.obj', true);
    const door_mesh = await load_mesh('objects/misc/door.obj', true, 0.35);
    const frame_mesh = await load_mesh('objects/misc/frame.obj', true, 1.0);

    // Make the buffer and the functions to draw the objects
    const glass_obj = make_object(gl, glass_mesh);
    const table_obj = make_object(gl, table_mesh, table_tex, table_bm);
    const lamp_obj_1 = make_object(gl, lamp_mesh);
    const lamp_obj_2 = make_object(gl, lamp_mesh);
    const lamp_obj_3 = make_object(gl, lamp_mesh);
    const lamp_table_obj = make_object(gl, lamp_table_mesh, lamp_table_tex, lamp_table_bm);
    const ch_clk_obj = make_object(gl, ch_clk_mesh, ch_clk_tex, null);
    const ch_clk_hand_l_obj = make_object(gl, ch_clk_hand_mesh);
    const ch_clk_hand_r_obj = make_object(gl, ch_clk_hand_mesh);
    const ch_clk_sec_hand_l_obj = make_object(gl, ch_clk_sec_hand_mesh);
    const ch_clk_sec_hand_r_obj = make_object(gl, ch_clk_sec_hand_mesh);
    const plant_obj = make_object(gl, plant_mesh, plant_tex, plant_bm);
    const walls_obj = make_object(gl, walls_mesh, walls_tex, walls_bm);
    const ceiling_obj = make_object(gl, ceiling_mesh, null, ceiling_bm, ceiling_material);
    const ground_obj = make_object(gl, ground_mesh, ground_tex, ground_bm, floor_material);
    const door_obj = make_object(gl, door_mesh, door_tex, door_bm);
    const frame_obj = make_object(gl, frame_mesh, frame_tex, null);

    // COLLISION BOXES
    const c_ch_clk_mesh = await load_mesh('objects/collision_boxes/c_ch_clock.obj', false);
    const c_lamp_table_mesh = await load_mesh('objects/collision_boxes/c_lamp_table.obj', false);

    // LIGHTS
    // Point Lights
    const orange_pl_1 = light_set.add_point_light(
        glMatrix.vec3.fromValues(-60.0, 25.0, 0.0),
        glMatrix.vec3.fromValues(5.0, 2.5, 0.0));
    const orange_pl_2 = light_set.add_point_light(
        glMatrix.vec3.fromValues(0.0, 25.0, 110.0),
        glMatrix.vec3.fromValues(5.0, 2.5, 0.0));
    const orange_pl_3 = light_set.add_point_light(
        glMatrix.vec3.fromValues(0.0, 25.0, -110.0),
        glMatrix.vec3.fromValues(5.0, 2.5, 0.0));

    const white_pl1 = light_set.add_point_light(
        glMatrix.vec3.fromValues(150.0, 15.0, 0.0),
        glMatrix.vec3.fromValues(20.0, 20.0, 20.0));

    // Spotlights
    const lamp_sl = light_set.add_spot_light(
        glMatrix.vec3.fromValues(10.0, 7.0, 15.0),
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        glMatrix.vec3.fromValues(0.0, -1.0, 0.0),
        20,
        130
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
    physics_engine.register_object(ground_obj, 0.0);
    physics_engine.register_object(frame_obj, 0.0);

    // Define specific materials for chess pieces in this scene
    const _piece_white_material = make_material(
        'white_piece',
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        100.0, 2.0,
        0.2
    );
    const _piece_black_material = make_material(
        'black_piece',
        glMatrix.vec3.fromValues(0.1, 0.1, 0.1),
        100.0, 2.0,
        0.2
    );
    chessboard.set_pieces_material(_piece_white_material, _piece_black_material);


    // SNOW !
    const snow_system1 = make_particle_flow(
        gl, camera,
        ParticleType.Sphere,
        glMatrix.vec3.fromValues(65.0, 38.0, -103.0), glMatrix.vec3.fromValues(65.0, 38.0, -43.0), glMatrix.vec3.fromValues(0.2, -1.0, 0.0),
        40.0, 40.0,
        500, 0.5,
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0), 0.1,
        2.5, glMatrix.vec3.fromValues(0.0, -0.05, 0.0),
        0.2
    );
    const snow_system2 = make_particle_flow(
        gl, camera,
        ParticleType.Sphere,
        glMatrix.vec3.fromValues(65.0, 38.0, -30.0), glMatrix.vec3.fromValues(65.0, 38.0, 30.0), glMatrix.vec3.fromValues(0.2, -1.0, 0.0),
        40.0, 40.0,
        500, 0.5,
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0), 0.1,
        2.5, glMatrix.vec3.fromValues(0.0, -0.05, 0.0),
        0.2
    );
    const snow_system3 = make_particle_flow(
        gl, camera,
        ParticleType.Sphere,
        glMatrix.vec3.fromValues(65.0, 38.0, 43.0), glMatrix.vec3.fromValues(65.0, 38.0, 103.0), glMatrix.vec3.fromValues(0.2, -1.0, 0.0),
        40.0, 40.0,
        500, 0.5,
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0), 0.1,
        2.5, glMatrix.vec3.fromValues(0.0, -0.05, 0.0),
        0.2
    );

    // Register the particle system
    particle_engine.register_particle_system(snow_system1);
    particle_engine.register_particle_system(snow_system2);
    particle_engine.register_particle_system(snow_system3);


    // Set initial object position, etc
    reset(0.0);

    function reset(anim_duration = 0.0) {
        // Positioning of the objects
        glass_obj.anim_to_position(glMatrix.vec3.fromValues(-10.0, 1.0, 18.0), anim_duration);
        table_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -5.0, 0.0), anim_duration);
        lamp_obj_1.anim_to_position(glMatrix.vec3.fromValues(-69.0, 10.0, 0.0), anim_duration);
        lamp_obj_2.anim_to_position(glMatrix.vec3.fromValues(0.0, 10.0, -115.0), anim_duration);
        lamp_obj_3.anim_to_position(glMatrix.vec3.fromValues(0.0, 10.0, 115.0), anim_duration);
        lamp_table_obj.anim_to_position(glMatrix.vec3.fromValues(10.0, -5.0, 15.0), anim_duration);
        ch_clk_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -5.0, -12.0), anim_duration);
        ch_clk_hand_l_obj.anim_to_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7), anim_duration);
        ch_clk_hand_r_obj.anim_to_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7), anim_duration);
        ch_clk_sec_hand_l_obj.anim_to_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7), anim_duration);
        ch_clk_sec_hand_r_obj.anim_to_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7), anim_duration);
        plant_obj.anim_to_position(glMatrix.vec3.fromValues(10.0, -5.0, -22.0), anim_duration);
        walls_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -37.0, 0.0), anim_duration);
        ground_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, -37.0, 0.0), anim_duration);
        ceiling_obj.anim_to_position(glMatrix.vec3.fromValues(0.0, 47.0, 0.0), anim_duration);
        door_obj.anim_to_position(glMatrix.vec3.fromValues(-68.0, -37.0, 60.0), anim_duration);
        frame_obj.anim_to_position(glMatrix.vec3.fromValues(-69.0, 0.0, -60.0), anim_duration);

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
        lamp_table_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_hand_l_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_hand_r_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_sec_hand_l_obj.anim_to_rotation(zero_rotation, anim_duration);
        ch_clk_sec_hand_r_obj.anim_to_rotation(zero_rotation, anim_duration);
        plant_obj.anim_to_rotation(zero_rotation, anim_duration);
        walls_obj.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), Math.PI/2);
        ground_obj.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), Math.PI/2);
        ceiling_obj.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), Math.PI/2);
        lamp_obj_1.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), Math.PI/2);
        lamp_obj_2.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), 0);
        lamp_obj_3.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), -Math.PI);
        door_obj.set_rotation(glMatrix.vec3.fromValues(0.0, 1.0, 0.0), Math.PI/2);
        plant_obj.anim_to_rotation(zero_rotation, anim_duration);

        // Reset physics
        force_physics(false);
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
    }

    function draw_cubemap(shader){
        cubemap.draw(shader);
    }

    function draw(shader){
        // Give cubemap textures (for reflection/refraction)
        cubemap.activate(shader);

        // Draw objects
        //glass_obj.draw(shader);
        table_obj.draw(shader);
        lamp_obj_1.draw(shader);
        lamp_obj_2.draw(shader);
        lamp_obj_3.draw(shader);
        lamp_table_obj.draw(shader);
        ch_clk_obj.draw(shader);
        ch_clk_hand_l_obj.draw(shader);
        ch_clk_hand_r_obj.draw(shader);
        ch_clk_sec_hand_l_obj.draw(shader);
        ch_clk_sec_hand_r_obj.draw(shader);
        plant_obj.draw(shader);
        walls_obj.draw(shader);
        ground_obj.draw(shader);
        ceiling_obj.draw(shader);
        door_obj.draw(shader);
        frame_obj.draw(shader);
        glass_obj.draw(shader);
    }

    function force_physics(force) {
        // Reset all forces/velocities
        if (force === false) {
            lamp_table_obj.reset_physics_motion();
            ch_clk_obj.reset_physics_motion();
            ch_clk_hand_l_obj.reset_physics_motion();
            ch_clk_hand_r_obj.reset_physics_motion();
            ch_clk_sec_hand_l_obj.reset_physics_motion();
            ch_clk_sec_hand_r_obj.reset_physics_motion();
            plant_obj.reset_physics_motion();
            frame_obj.reset_physics_motion();
        }

        table_obj.get_physics_body().set_mass(0.0);
        lamp_table_obj.get_physics_body().set_mass(force ? 2.0 : 0.0);
        ch_clk_obj.get_physics_body().set_mass(force ? 2.0 : 0.0);
        ch_clk_hand_l_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_hand_r_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_sec_hand_l_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        ch_clk_sec_hand_r_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        plant_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
        frame_obj.get_physics_body().set_mass(force ? 0.1 : 0.0);
    }

    function animateGameLost() {
        camera.set_special_orientation(0, 1000.0);

        // Parametrize a dust effect using a particle jet
        const fire_jet = make_particle_jet(
            gl, camera,
            ParticleType.Star,
            chessboard.get_position(), 6.5, glMatrix.vec3.fromValues(0.0, 1.0, 0.0),
            5.0,
            8000, 0.2,
            glMatrix.vec3.fromValues(0.0, 0.0, 0.0), 0.2,
            1.5, glMatrix.vec3.fromValues(0.0, -0.2, 0.0),
            0.75
        );

        // Register the particle system
        particle_engine.register_particle_system(fire_jet);
    }

    function animateGameWon() {
        camera.set_special_orientation(0, 1000.0);

        // Bengale fire at each edge of the chessboard!!!
        const fire1 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(-2, -2)),
            color: glMatrix.vec3.fromValues(1.0, 0.2, 0.2)
        };
        const fire2 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(-2, 9)),
            color: glMatrix.vec3.fromValues(0.2, 0.2, 1.0)
        };
        const fire3 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(9, 9)),
            color: glMatrix.vec3.fromValues(1.0, 0.2, 0.2)
        };
        const fire4 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(9, -2)),
            color: glMatrix.vec3.fromValues(0.2, 0.2, 1.0)
        };

        for (const fire of [fire1, fire2, fire3, fire4]) {
            // Parametrize a dust effect using a particle jet
            const fire_jet = make_particle_jet(
                gl, camera,
                ParticleType.Star,
                fire.pos, 0.1, glMatrix.vec3.fromValues(0.0, 1.0, 0.0),
                5.0,
                1000, 0.1,
                fire.color, 0.5,
                10.0, glMatrix.vec3.fromValues(0.0, -0.2, 0.0),
                1.5
            );

            // Register the particle system
            particle_engine.register_particle_system(fire_jet);
        }
    }

    function animateGameDraw() {
        camera.set_special_orientation(0, 1000.0);

        // Bengale fire at each edge of the chessboard!!!
        const fire1 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(-2, -2)),
            color: glMatrix.vec3.fromValues(1.0, 1.0, 1.0)
        };
        const fire2 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(-2, 9)),
            color: glMatrix.vec3.fromValues(1.0, 1.0, 1.0)
        };
        const fire3 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(9, 9)),
            color: glMatrix.vec3.fromValues(1.0, 1.0, 1.0)
        };
        const fire4 = {
            pos: chessboard.gameTo3DPosition(glMatrix.vec2.fromValues(9, -2)),
            color: glMatrix.vec3.fromValues(1.0, 1.0, 1.0)
        };

        for (const fire of [fire1, fire2, fire3, fire4]) {
            // Parametrize a dust effect using a particle jet
            const fire_jet = make_particle_jet(
                gl, camera,
                ParticleType.Star,
                fire.pos, 0.1, glMatrix.vec3.fromValues(0.0, 1.0, 0.0),
                5.0,
                1000, 0.1,
                fire.color, 0.5,
                10.0, glMatrix.vec3.fromValues(0.0, -0.2, 0.0),
                1.5
            );

            // Register the particle system
            particle_engine.register_particle_system(fire_jet);
        }
    }


    return{
        animate: animate,
        draw_cubemap: draw_cubemap,
        draw: draw,
        set_current_turn: set_current_turn,
        table: table_obj,
        force_physics: force_physics,
        reset: reset,
        on_game_event: on_game_event,
        animateGameLost: animateGameLost,
        animateGameWon: animateGameWon,
        animateGameDraw: animateGameDraw,
    }
}

