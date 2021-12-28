const setupPhysics = function() {
    function setupPhysicsWorld() {
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
              dispatcher             = new Ammo.btCollisionDispatcher(collisionConfiguration),
              overlappingPairCache   = new Ammo.btDbvtBroadphase(),
              solver                 = new Ammo.btSequentialImpulseConstraintSolver();

        const physics_world = new Ammo.btDiscreteDynamicsWorld(
              dispatcher,
              overlappingPairCache,
              solver,
              collisionConfiguration
        );
        physics_world.setGravity(new Ammo.btVector3(0, -10, 0));

        return physics_world;
    }

    function updatePhysics(deltaTime) {
        // Step world
        physicsWorld.stepSimulation(deltaTime, 10);

        // Update rigid bodies
        for (let i = 0 ; i < rigid_bodies.length ; i++) {
            const object = rigid_bodies[i];
            const ms = object.get_physics_body().getMotionState();

            // If there is something to do for this object
            if (ms) {
                // Get transform computed by physics engine
                ms.getWorldTransform(tmp_transform);
                const p = tmp_transform.getOrigin();
                const q = tmp_transform.getRotation();

                const scale = object.get_scaling();

                // Update the model matrix according to physics
                glMatrix.mat4.fromRotationTranslationScale(
                    object.model,
                    glMatrix.quat.fromValues(q.x(), q.y(), q.z(), q.w()),
                    glMatrix.vec3.fromValues(p.x(), p.y(), p.z()),
                    scale
                );
            }
        }
    }

    function createShapeFromObject(obj) {
        const shape = new Ammo.btConvexHullShape();
        for (let i = 0; i < obj.num_vertices ; i++) {
            shape.addPoint(new Ammo.btVector3(
                    obj.buffer[i * obj.vert_length],
                    obj.buffer[i * obj.vert_length + 1],
                    obj.buffer[i * obj.vert_length + 2]
                ),
                // Recalculate Aabb only on the last point
                i === obj.num_vertices - 1
            );
        }
        return shape;
    }

    function register_object(object, mass, collision_box_mesh = null) {
        const position = object.get_position();
        const rotation = object.get_rotation();
        const scaling  = object.get_scaling();

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
        transform.setRotation(new Ammo.btQuaternion(
            rotation[0], rotation[1], rotation[2], rotation[3]
        ));
        const motion_state = new Ammo.btDefaultMotionState(transform);

        // Create object shape from mesh
        const obj_shape = createShapeFromObject(collision_box_mesh !== null ?  collision_box_mesh : object.mesh);
        obj_shape.setLocalScaling(new Ammo.btVector3(scaling[0], scaling[1], scaling[2]));
        //obj_shape.setMargin(0.05);

        // Create the object with a mass of 1.0
        const rb_info = new Ammo.btRigidBodyConstructionInfo(1.0, motion_state, obj_shape);
        const body = new Ammo.btRigidBody(rb_info);
        //body.setSleepingThresholds(0, 0);
        body.orig_object = object;

        // Add this rigid body to the object, bodies list and physics world
        object.set_physics_body(body);
        rigid_bodies.push(object);
        physicsWorld.addRigidBody(body);

        // Hack: we create the object with a mass of 1, then we set its actual mass
        object.set_physics_mass(mass);

        return body;
    }

    function run_picking(picking_ray) {
        const ray_origin = picking_ray.start;
        const ray_dest = glMatrix.vec3.create();
        glMatrix.vec3.scaleAndAdd(ray_dest, ray_origin, picking_ray.dir, 1000.0);

        const tempVRayOrigin = new Ammo.btVector3();
        const tempVRayDest = new Ammo.btVector3();
        const closestRayResultCallback = new Ammo.ClosestRayResultCallback(tempVRayOrigin, tempVRayDest);
        const rayCallBack = Ammo.castObject(closestRayResultCallback, Ammo.RayResultCallback);
        rayCallBack.set_m_closestHitFraction(1);
        rayCallBack.set_m_collisionObject(null);

        // Set closestRayResultCallback origin and dest
        tempVRayOrigin.setValue(ray_origin[0], ray_origin[1], ray_origin[2]);
        tempVRayDest.setValue(ray_dest[0], ray_dest[1], ray_dest[2]);
        closestRayResultCallback.get_m_rayFromWorld().setValue(ray_origin[0], ray_origin[1], ray_origin[2]);
        closestRayResultCallback.get_m_rayToWorld().setValue(ray_dest[0], ray_dest[1], ray_dest[2]);

        // Perform ray test
        physicsWorld.rayTest(tempVRayOrigin, tempVRayDest, closestRayResultCallback);

        return closestRayResultCallback;
    }

    const physicsWorld = setupPhysicsWorld();

    const rigid_bodies = [];
    const tmp_transform = new Ammo.btTransform();

    return {
        update: updatePhysics,
        world: physicsWorld,
        register_object: register_object,
        run_picking: run_picking
    };
}