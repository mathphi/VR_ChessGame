async function make_evening_lights_scene(gl, camera, chessboard, physics_engine, light_set){
    // CUBEMAP
    const cubemap = await make_cubemap(gl, 'objects/misc/cube.obj', 'textures/cubemaps/Nalovardo', 1024);

    // TEXTURES
    const table_tex = await load_texture(gl, 'textures/Wood.jpg', true);
    const ch_clk_tex = await load_texture(gl, 'textures/ch_clock_tex.png', true);
    const lamp_table_tex = await load_texture(gl, 'textures/lamp_table_tex.jpg', true);

    // BUMP MAPS
    const table_bm = await load_texture(gl, 'textures/WoodBumpMap.png', true);
    const lamp_table_bm = await load_texture(gl, 'textures/lamp_table_bm.png', true);

    // OBJECTS
    // Loading objects from files
    const glass_mesh = load_obj('objects/misc/glass.obj', false);
    const table_mesh = load_obj('objects/misc/table.obj', true);
    const lamp_mesh = load_obj('objects/misc/lamp.obj', false);
    const lamp_table_mesh = load_obj('objects/misc/lamp_table.obj', true);
    const ch_clk_mesh = load_obj('objects/misc/ch_clock.obj', true);
    const ch_clk_hand_mesh = load_obj('objects/misc/ch_clock_hand.obj', false);
    const ch_clk_sec_hand_mesh = load_obj('objects/misc/clock_sec.obj', false);
    // Make the buffer and the functions to draw the objects
    const glass_obj = await make_object(gl, glass_mesh);
    const table_obj = await make_object(gl, table_mesh, table_tex, table_bm);
    const lamp_obj = await make_object(gl, lamp_mesh);
    const lamp_table_obj = await make_object(gl, lamp_table_mesh, lamp_table_tex, lamp_table_bm);
    const ch_clk_obj = await make_object(gl, ch_clk_mesh, ch_clk_tex, null);
    const ch_clk_hand_l_obj = await make_object(gl, ch_clk_hand_mesh);
    const ch_clk_hand_r_obj = await make_object(gl, ch_clk_hand_mesh);
    const ch_clk_sec_hand_l_obj = await make_object(gl, ch_clk_sec_hand_mesh);
    const ch_clk_sec_hand_r_obj = await make_object(gl, ch_clk_sec_hand_mesh);

    // Positioning of the objects
    glass_obj.set_position(glMatrix.vec3.fromValues(-10.0, 1.0, 18.0));

    table_obj.set_position(glMatrix.vec3.fromValues(0.0, -5.0, 0.0));
    table_obj.model = glMatrix.mat4.scale(table_obj.model, table_obj.model,
        glMatrix.vec3.fromValues(1.0, 1.0, 1.0));

    lamp_obj.set_position(glMatrix.vec3.fromValues(0.0, -40.0, -50.0));
    lamp_obj.model = glMatrix.mat4.scale(lamp_obj.model, lamp_obj.model,
        glMatrix.vec3.fromValues(20.0, 20.0, 20.0));

    lamp_table_obj.set_position(glMatrix.vec3.fromValues(10.0, -5.0, 15.0));

    ch_clk_obj.set_position(glMatrix.vec3.fromValues(0.0, -5.0, -12.0));
    ch_clk_hand_l_obj.set_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7));
    ch_clk_hand_l_obj.model = glMatrix.mat4.scale(ch_clk_hand_l_obj.model, ch_clk_hand_l_obj.model,
        glMatrix.vec3.fromValues(1.5, 1.5, 1.5));
    ch_clk_hand_r_obj.set_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7));
    ch_clk_hand_r_obj.model = glMatrix.mat4.scale(ch_clk_hand_r_obj.model, ch_clk_hand_r_obj.model,
        glMatrix.vec3.fromValues(1.5, 1.5, 1.5));
    ch_clk_sec_hand_l_obj.set_position(glMatrix.vec3.fromValues(-1.5, -3.3, -10.7));
    ch_clk_sec_hand_l_obj.model = glMatrix.mat4.scale(ch_clk_sec_hand_l_obj.model, ch_clk_sec_hand_l_obj.model,
        glMatrix.vec3.fromValues(0.7, 0.7, 0.7));
    ch_clk_sec_hand_r_obj.set_position(glMatrix.vec3.fromValues(1.5, -3.3, -10.7));
    ch_clk_sec_hand_r_obj.model = glMatrix.mat4.scale(ch_clk_sec_hand_r_obj.model, ch_clk_sec_hand_r_obj.model,
        glMatrix.vec3.fromValues(0.7, 0.7, 0.7));

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

    // CUSTOM CAMERA POSITIONNING


    // OBJECTS PHYSICS
    physics_engine.register_object(table_obj, 0.0);
    physics_engine.register_object(glass_obj, 1.0);
    physics_engine.register_object(ch_clk_obj, 0.0, c_ch_clk_mesh);
    physics_engine.register_object(lamp_table_obj, 0.0, c_lamp_table_mesh);

    let _current_turn = chessboard.get_turn();

    function set_current_turn(turn){
        _current_turn = turn;
    }

    function animate(time, delta_time){
        // Animate clock hands
        if(_current_turn === 'w'){
            ch_clk_hand_l_obj.model = glMatrix.mat4.rotateZ(ch_clk_hand_l_obj.model, ch_clk_hand_l_obj.model, 6*delta_time / (60*1000*180) * Math.PI);
            ch_clk_sec_hand_l_obj.model = glMatrix.mat4.rotateZ(ch_clk_sec_hand_l_obj.model, ch_clk_sec_hand_l_obj.model, 6*delta_time / (1000*180) * Math.PI);
        }
        else{
            ch_clk_hand_r_obj.model = glMatrix.mat4.rotateZ(ch_clk_hand_r_obj.model, ch_clk_hand_r_obj.model, 6*delta_time / (60*1000*180)  * Math.PI);
            ch_clk_sec_hand_r_obj.model = glMatrix.mat4.rotateZ(ch_clk_sec_hand_r_obj.model, ch_clk_sec_hand_r_obj.model, 6*delta_time / (1000*180) * Math.PI);
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
            glMatrix.vec3.fromValues(5.0 + 1.0*light_int, 2.5+0.5*light_int, 0.0)
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
    }


    return{
        animate:animate,
        draw_cubemap:draw_cubemap,
        draw:draw,
        set_current_turn:set_current_turn,
    }
}

