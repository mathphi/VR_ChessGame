
const MouseButtons = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2,
    MIDDLE: 4
}

// Hyper-global variables
let _mouse_action_button = MouseButtons.LEFT;
let _mouse_view_button = MouseButtons.RIGHT;

document.addEventListener("DOMContentLoaded", function() {
    // Prevent right-click context menu on the whole page
    document.addEventListener('contextmenu', event => event.preventDefault());

    window.onbeforeunload = function () {
        return "Are you sure you want to quit the game?";
    }

    // Cookies life
    const _cookies_lifetime = 365;  // Days

    // Sound On
    let _sound_on = false;

    // Pager overlay
    const _page_loader_overlay = document.querySelector("#page-loader-overlay");

    // AI Thinking indicator
    const _ai_thinking_indicator = document.querySelector("#ai-thinking-indicator");

    // Top-bar elements
    const _auto_cam_input = document.querySelector("#auto-cam");
    const _ai_enabled_input = document.querySelector("#ai-enabled");
    const _ai_level_input = document.querySelector("#ai-level");
    const _new_game_button = document.querySelector("#new-game");
    const _volume_button = document.querySelector("#sound");

    // Notification functions
    let _notify_timeout_id = null;
    const _notify_overlay = document.querySelector("#canvas_overlay");
    const _notify_text = document.querySelector("#notify_text");

    function show_notify(html_content, duration, fade_duration = 200.0) {
        _notify_text.innerHTML = html_content;
        _notify_overlay.hidden = false;

        const init_t = performance.now();

        function fade_in(t_abs) {
            const t = t_abs - init_t;
            const x = t / fade_duration;

            // Fade opacity
            _notify_overlay.style.opacity = x.toString();

            if (t < fade_duration) {
                window.requestAnimationFrame(fade_in);
            }
        }

        fade_in(init_t);

        clearTimeout(_notify_timeout_id);

        if (duration > 0.0) {
            _notify_timeout_id = setTimeout(hide_notify, duration);
        }
    }

    function hide_notify(fade_duration = 200.0) {
        const init_t = performance.now();

        function fade_out(t_abs) {
            const t = t_abs - init_t;
            const x = t / fade_duration;

            // Fade opacity
            _notify_overlay.style.opacity = (1.0 - x).toString();

            if (t < fade_duration) {
                window.requestAnimationFrame(fade_out);
            } else {
                _notify_overlay.hidden = true;
                _notify_text.innerHTML = '';
            }
        }

        fade_out(init_t);
    }

    function show_game_won(winner) {
        show_notify(
            `<span style="font-size: 36pt;">` +
            `${winner === 'w' ? "White" : "Black"} pieces won!` +
            `</span>`,
            -1
        );
    }

    function show_game_lost() {
        show_notify(
            `<span style="font-size: 36pt;">` +
            `You lost!` +
            `</span>`,
            -1
        );
    }

    function show_game_draw() {
        show_notify(
            `<span style="font-size: 36pt;">Draw!</span>`,
            -1
        );
    }

    function toggle_mouse_buttons() {
        if (_mouse_action_button === MouseButtons.LEFT) {
            _mouse_action_button = MouseButtons.RIGHT;
            _mouse_view_button = MouseButtons.LEFT;
        } else {
            _mouse_action_button = MouseButtons.LEFT;
            _mouse_view_button = MouseButtons.RIGHT;
        }

        show_notify("Mouse buttons inverted", 2000.0);
    }

    function init_ui() {
        // Initialize UI according to cookies

        // Auto camera rotation settings
        const c_cam_auto_rotate = getCookie('cam_auto_rotate');
        _auto_cam_input.checked = (c_cam_auto_rotate !== '0');

        // AI settings
        const c_ai_enabled = getCookie('ai_enabled');
        const c_ai_level = getCookie('ai_level');
        _ai_enabled_input.checked = (c_ai_enabled === '1');
        _ai_level_input.value = (c_ai_level !== '' ? c_ai_level : '1');

        // Sound settings
        _sound_on = getCookie('sound_on') === "true";
        _volume_button.setAttribute('snd', _sound_on ? 'on' : 'off');
    }

    function get_mouse_pos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return glMatrix.vec2.fromValues(
            // Mouse coordinates relative to canvas (not screen)
            evt.clientX - rect.left,
            evt.clientY - rect.top
        );
    }

    async function main() {
        // Initialize UI
        init_ui();

        // Initialize GL and canvas
        const canvas = document.getElementById('webgl_canvas');
        let c_width = canvas.clientWidth;
        let c_height = canvas.clientHeight;
        canvas.width = c_width;
        canvas.height = c_height;
        const gl = canvas.getContext('webgl2');
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);    // Enable face culling to save computation time

        // Settings for the blending function (used when blending is enabled, i.e. for particles)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // FAR AND NEAR PLANE FOR DEPTH TESTING
        const near_plane = 0.01;
        const far_plane = 200.0;

        // PHYSICS ENGINE
        const physics_engine = setupPhysics();
        physics_engine.set_time_acceleration(1.5);  // Artificial but gives nice results

        // LIGHTSET
        // WARNING: shader code designed for max 10 lights !
        const light_set = make_lights_set(gl);

        // SHADERS
        // Compile a shader program from the sources of "common_shader"
        const shader_common = await make_shader(gl, 'common_shader', 'shaders');
        // Compile a shader program from the sources of "cubemap_shader"
        const shader_cubemap = await make_shader(gl, 'cubemap_shader', 'shaders');
        // Compile a shader specific to move squares
        const move_squares_shader = await make_shader(gl, 'move_squares_shader', 'shaders');
        // Compile a shader specific to particles
        const particles_shader = await make_shader(gl, 'particles_shader', 'shaders');

        // CAMERA
        // Create camera
        const camera = make_camera(
            canvas,
            18.0, 0.0, 0.0,
            glMatrix.vec3.fromValues(0.0, 1.0, 0.0),
            glMatrix.vec3.fromValues(0.0, 0.0, 0.0)
        );

        // Get camera projection
        let projection = camera.set_projection(45.0, c_width / c_height, near_plane, far_plane);

        // Camera position
        const u_cam_pos = gl.getUniformLocation(shader_common.program, 'u_cam_pos');

        function on_cam_config_changed() {
            setCookie('cam_auto_rotate', _auto_cam_input.checked ? 1 : 0, _cookies_lifetime);
        }

        _auto_cam_input.addEventListener('change', on_cam_config_changed);

        // PARTICLES ENGINE
        const particle_engine = make_particles_engine(gl, camera);

        // CHESSBOARD
        // Make chessboard
        const chessboard = await make_chessboard(
            gl, camera, physics_engine, light_set, particle_engine
        );
        chessboard.set_sound_on(_sound_on);

        // Event when AI checkbox is changed
        _ai_enabled_input.addEventListener('change', on_ai_config_changed);
        _ai_level_input.addEventListener('change', on_ai_config_changed);
        _new_game_button.addEventListener('click', restart_new_game);
        _volume_button.addEventListener("click", toggle_sound);

        function on_ai_config_changed() {
            // Store configuration in cookies
            setCookie('ai_enabled', _ai_enabled_input.checked ? 1 : 0, _cookies_lifetime);
            setCookie('ai_level', _ai_level_input.value, _cookies_lifetime);

            // Disable select input if AI disabled
            _ai_level_input.disabled = !_ai_enabled_input.checked;

            // Set the AI level and state
            chessboard.enable_ai(
                _ai_enabled_input.checked,
                parseInt(_ai_level_input.value)
            );
        }

        // Initialize AI according to GUI
        on_ai_config_changed();

        function restart_new_game() {
            if (confirm("Are you sure you want to start a new game?")) {
                _phys_forced = false;
                scene.reset(500.0);
                chessboard.force_phycics(false);
                setTimeout(chessboard.reset_game, 600.0);
                hide_notify();
            }
        }

        function toggle_sound() {
            _sound_on = !_sound_on;
            setCookie('sound_on', _sound_on, _cookies_lifetime);
            _volume_button.setAttribute('snd', _sound_on ? 'on' : 'off');
            chessboard.set_sound_on(_sound_on);
        }

        // SCENE
        const scene = await make_scene('evening_lights', gl, camera, chessboard, physics_engine, light_set, particle_engine);
        scene.set_current_turn(chessboard.get_turn());

        // Set initial camera position to special position 0 (defined by the scene)
        camera.set_special_orientation(0, 0.0);

        // Change camera view to player
        setTimeout(function () {
            camera.set_special_orientation(2);
        }, 2000.0);

        // TURN CHANGE EVENT
        function on_turn_change_event(turn) {
            scene.set_current_turn(turn);

            // Change camera view to player
            if (!chessboard.is_ai_enabled() && _auto_cam_input.checked) {
                setTimeout(function () {
                    camera.set_special_orientation(turn === 'w' ? 2 : 8, 2000.0);
                }, 1000.0);
            }
        }

        // GAME EVENTS
        function on_game_event(event, player) {
            console.log("Game event received (flags: " + event + ", player: '" + player + "')");
            if (event & ChessSituation.Checkmate) {
                show_notify("Checkmate!", 2000.0);
            } else if (event & ChessSituation.InsufMat) {
                show_notify("Insufficient material!", 2000.0);
            } else if (event & ChessSituation.Check) {
                show_notify("Check!", 2000.0);
            } else if (event & ChessSituation.Threefold) {
                show_notify("Threefold!", 2000.0);
            } else if (event & ChessSituation.Stalemate) {
                show_notify("Stalemate!", 2000.0);
            }

            if (event & ChessSituation.Checkmate) {
                if (chessboard.is_ai_enabled() && player === 'b') {
                    // The (only) player lost
                    setTimeout(function () {
                        show_game_lost();
                    }, 2500.0);
                    setTimeout(function () {
                        scene.animateGameLost();
                        chessboard.playEndgameSound("lose");
                    }, 1000.0);
                } else {
                    // If a player won
                    setTimeout(function () {
                        show_game_won(player);
                    }, 2500.0);
                    setTimeout(function () {
                        scene.animateGameWon();
                        chessboard.playEndgameSound("win");
                    }, 1000.0);
                }
            } else if (event & ChessSituation.Draw) {
                setTimeout(function () {
                    show_game_draw();
                }, 2500.0);
                setTimeout(function () {
                    scene.animateGameDraw();
                    chessboard.playEndgameSound("draw");
                }, 1000.0);
            }

            scene.on_game_event(event);
        }

        // CHESS AI THINKING EVENT
        function on_ai_thinking_event(is_thinking) {
            if (is_thinking) {
                _ai_thinking_indicator.classList.add("shown");
            }
            else {
                _ai_thinking_indicator.classList.remove("shown");
            }
        }

        // Register chessboard callbacks
        chessboard.register_on_turn_change_callback(on_turn_change_event);
        chessboard.register_on_game_event_callback(on_game_event);
        chessboard.register_on_ai_thinking_callback(on_ai_thinking_event);

        // MOUSE EVENTS
        function on_mouse_event(event) {
            // Compute the picking ray from mouse cursor
            const picking_ray = camera.get_picking_ray(
                get_mouse_pos(canvas, event),
                canvas.clientWidth, canvas.clientHeight
            );

            // Run picking using the computed ray
            const picking_result = physics_engine.run_picking(picking_ray);

            // If the ray hit an object in the world
            if (picking_result.hasHit()) {
                // Get the picked body and its intersection point in 3D space
                const picked_body = Ammo.castObject(picking_result.get_m_collisionObject(), Ammo.btRigidBody);
                const picked_point = picking_result.get_m_hitPointWorld();

                // If this event was fired by a mousedown event and action button is pressed
                if (event.buttons & _mouse_action_button && event.type === "mousedown") {
                    // If ctrl key is not pressed
                    if (!event.ctrlKey) {
                        // If the picked object comes from the chessboard
                        if (picked_body.orig_object.from_chess !== undefined) {
                            // Send the information to the chessboard
                            chessboard.on_chess_clicked(
                                picked_body.orig_object,
                                glMatrix.vec3.fromValues(
                                    picked_point.x(), picked_point.y(), picked_point.z()
                                )
                            );
                        }
                    }
                    // If ctrl is pressed -> toggle the object's mass
                    else {
                        if (picked_body.orig_object.mass === undefined) {
                            picked_body.orig_object.mass = 1.0;
                        }
                        const new_mass = (picked_body.orig_object.mass === 1.0 ? 0.0 : 1.0);
                        picked_body.orig_object.set_physics_mass(new_mass);
                        picked_body.orig_object.mass = new_mass;
                        picked_body.orig_object.reset_physics_motion();
                        picked_body.activate(false);
                    }
                } else if (event.buttons & MouseButtons.MIDDLE && event.type === "mousedown") {
                    const picked_point = picking_result.get_m_hitPointWorld();
                    camera.anim_camera_orientation(
                        null, null, null,
                        glMatrix.vec3.fromValues(
                            picked_point.x(), picked_point.y(), picked_point.z()
                        ),
                        500.0
                    );
                } else {
                    // If the picked object comes from the chessboard
                    if (picked_body.orig_object.from_chess !== undefined) {
                        // Send the information to the chessboard
                        chessboard.on_chess_hover(
                            picked_body.orig_object,
                            glMatrix.vec3.fromValues(
                                picked_point.x(), picked_point.y(), picked_point.z()
                            )
                        );
                    }
                }
            }

            // Free memory for this picking result
            Ammo.destroy(picking_result);
        }

        canvas.addEventListener("mousedown", on_mouse_event);
        canvas.addEventListener("mousemove", on_mouse_event);

        // KEYBOARD EVENTS
        let _phys_forced = false;
        document.addEventListener("keydown", function (event) {
            const x_axis = glMatrix.vec3.fromValues(1.0, 0.0, 0.0);
            const z_axis = glMatrix.vec3.fromValues(0.0, 0.0, 1.0);

            switch (event.key) {
                case "Escape":
                    hide_notify(200.0);
                    break;
                case 'p':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        chessboard.force_phycics(!_phys_forced);
                        scene.force_physics(!_phys_forced);
                        _phys_forced = !_phys_forced;

                        show_notify(_phys_forced ? "Objects unlocked" : "Objects locked", 1000.0);
                    }
                    break;
                case 'z':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        // Crtl+Z -> undo last action
                        chessboard.undo_game();
                        hide_notify();
                    } else {
                        if (_phys_forced) {
                            scene.table.rotate(z_axis, -5.0 * Math.PI / 180.0);
                        }
                    }
                    break;
                case 's':
                    // CTRL + S -> save game to cookies
                    if (event.ctrlKey) {
                        event.preventDefault();
                        setCookie('last-savegame-pgn', chessboard.get_board_pgn(), _cookies_lifetime);
                        show_notify("Game state saved", 2000.0);
                    }
                    // ALT + S -> download savegame file
                    else if (event.altKey) {
                        event.preventDefault();
                        const now = new Date();
                        const dt_suffix = now.getFullYear() + '-'
                                        + (now.getMonth()+1).toString().padStart(2,'0') + '-'
                                        + now.getDate().toString().padStart(2,'0')
                                        + '_'
                                        + now.getHours().toString().padStart(2,'0') + '-'
                                        + now.getMinutes().toString().padStart(2,'0') + '-'
                                        + now.getSeconds().toString().padStart(2,'0');
                        downloadContent('chess-savegame_' + dt_suffix + '.chess-sav', chessboard.get_board_pgn());
                    }
                    else {
                        if (_phys_forced) {
                            scene.table.rotate(z_axis, 5.0 * Math.PI / 180.0);
                        }
                    }
                    break;
                case 'r':
                    // CTRL+R -> load last saved game from cookies
                    if (event.ctrlKey) {
                        event.preventDefault();
                        const saved_game = getCookie('last-savegame-pgn');

                        if (saved_game !== false) {
                            if (confirm("Are you sure you want to restore the last saved game?")) {
                                const prev_game = chessboard.get_board_pgn();
                                const validated = chessboard.load_board_pgn(saved_game);

                                // Restore previous game if it was invalid
                                if (!validated) {
                                    chessboard.load_board_pgn(prev_game);
                                }

                                show_notify(
                                    validated
                                        ? "Saved game successfully restored"
                                        : "Unable to restore the saved game", 2000.0
                                );
                            }
                        } else {
                            show_notify("No saved game to restore", 2000.0);
                        }
                    }
                    // ALT+R -> load savegame file
                    else if (event.altKey) {
                        event.preventDefault();

                        // Open the file choosing dialog
                        openFileDialog(function (file_content) {
                            const prev_game = chessboard.get_board_pgn();
                            const validated = chessboard.load_board_pgn(file_content);

                            // Restore previous game if it was invalid
                            if (!validated) {
                                chessboard.load_board_pgn(prev_game);
                            }

                            show_notify(
                                validated
                                    ? "Saved game successfully restored"
                                    : "Unable to restore the saved game", 2000.0
                            );
                        });
                    }
                    break;
                case 'q':
                    if (_phys_forced) {
                        scene.table.rotate(x_axis, -5.0 * Math.PI / 180.0);
                    }
                    break;
                case 'd':
                    if (_phys_forced) {
                        scene.table.rotate(x_axis, 5.0 * Math.PI / 180.0);
                    }
                    break;
                case 'g':
                    // CTRL + G -> new game
                    if (event.ctrlKey) {
                        event.preventDefault();
                        restart_new_game();
                    }
                    break;
                case 'm':
                    // CTRL + M -> invert mouse buttons
                    if (event.ctrlKey) {
                        event.preventDefault();
                        toggle_mouse_buttons();
                    }
                    break;
                default:
                    break;
            }
        });

        // Elapsed time label element
        const elapsedElem = document.querySelector("#elapsed");

        // Remove the page loader overlay
        _page_loader_overlay.hidden = true;

        // Call it once to ensure good size after everything is loaded
        onWindowResize();

        // ANIMATION
        let prev_time = performance.now();
        let delta_time = 0;

        function animate(time) {
            delta_time = time - prev_time;
            prev_time = time;

            // Update elapsed label
            elapsedElem.innerHTML = "Elapsed: " + timeToHuman(time);
            // Update the physics
            physics_engine.update(delta_time / 1000.0); // Delta time in seconds

            // Animate the scene elements
            scene.animate(time, delta_time);

            // Update the particles
            particle_engine.update(delta_time / 1000.0);

            /***********************
             **   Common shader   **
             ***********************/

            // We use the "common shader"
            shader_common.use();
            shader_common.set_projection_uniform(projection);
            shader_common.set_view_uniform(camera.get_view_matrix());

            // Add the viewer position
            gl.uniform3fv(u_cam_pos, camera.get_position());

            // Draw the lights and objects
            light_set.activate(shader_common);
            scene.draw(shader_common);
            chessboard.draw(shader_common);

            /*****************************
             **   Move squares shader   **
             *****************************/

            // Draw the move squares (using its specific shader)
            move_squares_shader.use();
            move_squares_shader.set_projection_uniform(projection);
            move_squares_shader.set_view_uniform(camera.get_view_matrix());
            chessboard.draw_move_squares(move_squares_shader);

            /************************
             **   Cubemap shader   **
             ************************/

            // Disable face culling while drawing the cubemap
            gl.disable(gl.CULL_FACE);

            // Draw the cubemap (using shader_cubemap)
            // For performance concerns, we draw the cubemap after the objects, such that its fragment shader
            // is not activated for pixels behind the objects.
            shader_cubemap.use();
            shader_cubemap.set_projection_uniform(projection);
            shader_cubemap.set_view_uniform(camera.get_view_matrix());
            scene.draw_cubemap(shader_cubemap);

            gl.enable(gl.CULL_FACE);

            /**************************
             **   Particles shader   **
             **************************/

            // Enable transparency
            gl.enable(gl.BLEND);

            particles_shader.use();
            particles_shader.set_projection_uniform(projection);
            particles_shader.set_view_uniform(camera.get_view_matrix());
            particle_engine.draw(particles_shader);

            // Disable transparency
            gl.disable(gl.BLEND);


            fps(time);
            window.requestAnimationFrame(animate); // While(True) loop!
        }

        // FPS COUNTER
        let prev = 0;
        const fpsElem = document.querySelector("#fps");

        function fps(now) {
            now *= 0.001;
            const deltaTime = now - prev;
            prev = now;
            const fps = 1 / deltaTime;
            fpsElem.textContent = 'FPS: ' + fps.toFixed();
            return fps;
        }

        function timeToHuman(time) {
            t_sec = time / 1000.0;
            const sec = Math.floor(t_sec % 60);
            t_sec /= 60.0;
            const min = Math.floor(t_sec % 60);
            const hour = Math.floor(t_sec / 60.0);

            let str = '';
            if (hour > 0) {
                str += hour.toFixed(0) + 'h&nbsp;';
            }
            if (min > 0) {
                str += min.toFixed(0) + 'm&nbsp;';
            }

            return str + sec.toFixed(0) + 's';
        }

        // CANVAS & CAMERA RESIZE WITH WEBPAGE
        function onWindowResize() {
            c_width = canvas.clientWidth;
            c_height = canvas.clientHeight;

            canvas.width = c_width;
            canvas.height = c_height;

            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            projection = camera.set_projection(45.0, c_width / c_height, near_plane, far_plane);
        }

        window.onresize = onWindowResize;

        animate(performance.now());
    }

    Ammo().then(main);
});