
function initialize_scene_selector(current_scene, on_scene_change) {
    const scene_button = document.getElementById("scene");
    const scenes_panel = document.getElementById("scenes-panel");

    let panel_shown = false;
    scene_button.addEventListener('click', function () {
        if (panel_shown) {
            panel_shown = false;
            scene_button.classList.remove('active');
            scenes_panel.classList.remove('shown');
        }
        else {
            panel_shown = true;
            scene_button.classList.add('active');
            scenes_panel.classList.add('shown');
        }
    });

    // Apply events to each item
    for (const item of scenes_panel.children) {
        // Only if it is a scene-item
        if (item.classList.contains("scene-item")) {
            item.addEventListener('click', function () {
                panel_shown = false;
                scene_button.classList.remove('active');
                scenes_panel.classList.remove('shown');

                if (item.classList.contains('selected'))
                    return;

                on_scene_change(item.getAttribute("value"));
            });

            if (item.getAttribute("value") === current_scene) {
                item.classList.add("selected");
            }
        }
    }
}

async function make_scene(name, gl, camera, chessboard, physics_engine, light_set, particle_engine) {
    let scene_generator;

    switch(name) {
        case 'evening_lights':
            scene_generator = make_evening_lights_scene;
            break;
        case 'niagara_falls':
            scene_generator = make_niagara_falls_scene;
            break;
        case 'cosy_interior':
            scene_generator = make_cosy_interior_scene;
            break;
        default:
            scene_generator = make_evening_lights_scene;
            break;
    }

    return scene_generator(gl, camera, chessboard, physics_engine, light_set, particle_engine);
}


