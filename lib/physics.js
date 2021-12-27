const setupPhysics = function() {
    function setupPhysicsWorld() {
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
            dispatcher               = new Ammo.btCollisionDispatcher(collisionConfiguration),
            overlappingPairCache     = new Ammo.btDbvtBroadphase(),
            solver                   = new Ammo.btSequentialImpulseConstraintSolver();

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

                // Update the model matrix according to physics
                glMatrix.mat4.fromRotationTranslation(
                    object.model,
                    glMatrix.vec3.fromValues(p.x(), p.y(), p.z()),
                    glMatrix.quat.fromValues(q.x(), q.y(), q.z(), q.w())
                );
            }
        }
    }

    function register_object(object, mass) {
        const position = object.get_position();
        const rotation = object.get_rotation();

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
        transform.setRotation(new Ammo.btQuaternion(
            rotation[0], rotation[1], rotation[2], rotation[3]
        ));
        const motion_state = new Ammo.btDefaultMotionState(transform);

        //TODO: do it for any box shape
        const col_shape = new Ammo.btBoxShape(new Ammo.btVector3(1.0, 1.0, 1.0));
        col_shape.setMargin(0.05);

        const local_inertia = new Ammo.btVector3(0.0, 0.0, 0.0);
        col_shape.calculateLocalInertia(mass, local_inertia);

        const rb_info = new Ammo.btRigidBodyConstructionInfo(mass, motion_state, col_shape, local_inertia);
        const body = new Ammo.btRigidBody(rb_info);
        body.orig_object = object;

        object.set_physics_body(body);
        rigid_bodies.push(object);

        physicsWorld.addRigidBody(body);

        return body;
    }

    const physicsWorld = setupPhysicsWorld();

    const rigid_bodies = [];
    const tmp_transform = new Ammo.btTransform();

    return {
        update: updatePhysics,
        world: physicsWorld,
        register_object: register_object
    };
}