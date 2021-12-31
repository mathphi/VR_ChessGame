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

    let _time_acceleration = 1.0;
    function set_time_acceleration(accel) {
        _time_acceleration = accel;
    }

    function updatePhysics(deltaTime) {
        // Step world
        physicsWorld.stepSimulation(deltaTime * _time_acceleration, 10);

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

                // Center of mass
                const com = object.get_physics_body().com;

                // Update the model matrix according to physics
                glMatrix.mat4.fromRotationTranslationScale(
                    object.model,
                    glMatrix.quat.fromValues(q.x(), q.y(), q.z(), q.w()),
                    glMatrix.vec3.fromValues(p.x(), p.y(), p.z()),
                    scale
                );
                // Translate by the opposite of the center of mass.
                // This compensates the origin offset since the physics uses the center
                // of mass to compute the transformations, unlike GL which uses a fixed
                // point of the mesh as the origin.
                glMatrix.mat4.translate(
                    object.model,
                    object.model,
                    glMatrix.vec3.fromValues(-com.x(), -com.y(), -com.z())
                );
            }
        }
    }

    function computeMeshCenterOfMass(mesh) {
        // Create some buffers
        const tmp_det_mat = glMatrix.mat3.create();
        const center_vect = glMatrix.vec3.create();

        // Initialize volume sum to 0
        let volume_sum = 0;
        let vol_pos_sum = glMatrix.vec3.fromValues(0.0, 0.0, 0.0);

        // Cut the mesh into tetrahedrons
        for (let i = 0 ; i < mesh.num_vertices - 2 ; i += 3) {
            // Compute volume and center of tetrahedron [p1,p2,p3,(0,0,0)]
            const p1 = glMatrix.vec3.fromValues(
                mesh.buffer[i * mesh.vert_length],
                mesh.buffer[i * mesh.vert_length + 1],
                mesh.buffer[i * mesh.vert_length + 2]
            );
            const p2 = glMatrix.vec3.fromValues(
                mesh.buffer[(i+1) * mesh.vert_length],
                mesh.buffer[(i+1) * mesh.vert_length + 1],
                mesh.buffer[(i+1) * mesh.vert_length + 2]
            );
            const p3 = glMatrix.vec3.fromValues(
                mesh.buffer[(i+2) * mesh.vert_length],
                mesh.buffer[(i+2) * mesh.vert_length + 1],
                mesh.buffer[(i+2) * mesh.vert_length + 2]
            );

            // Create a matrix with the 3 vectors
            glMatrix.mat3.set(tmp_det_mat,
                p1[0], p1[1], p1[2],
                p2[0], p2[1], p2[2],
                p3[0], p3[1], p3[2]
            );

            // The matrix determinant is proportional to the volume
            const tetra_volume = 1.0 / 6.0 * glMatrix.mat3.determinant(tmp_det_mat);

            // Compute the center of mass of the tetrahedron
            glMatrix.vec3.add(center_vect, p1, p2);
            glMatrix.vec3.add(center_vect, center_vect, p3);
            glMatrix.vec3.scale(center_vect, center_vect, 1.0 / 4.0);

            // The center of mass must be weighted by the volume
            glMatrix.vec3.scale(center_vect, center_vect, tetra_volume);

            // Add the computed values to the sum
            volume_sum += tetra_volume;
            glMatrix.vec3.add(vol_pos_sum, vol_pos_sum, center_vect);
        }

        // Finally, the center of mass is the sum of weighted center of mass of each
        // tetrahedron divided by the total volume.
        glMatrix.vec3.scale(vol_pos_sum, vol_pos_sum, 1.0 / volume_sum);

        return vol_pos_sum;
    }

    function createShapeFromObject(obj, center_of_mass) {
        const shape = new Ammo.btConvexHullShape();
        for (let i = 0; i < obj.points.length ; i++) {
            // The whole mesh is translated by the center of mass to ensure coherent
            // physics with movements.
            shape.addPoint(new Ammo.btVector3(
                    obj.points[i][0] - center_of_mass.x(),
                    obj.points[i][1] - center_of_mass.y(),
                    obj.points[i][2] - center_of_mass.z()
                ),
                // Recalculate Aabb only on the last point
                i === obj.points.length - 1
            );
        }
        return shape;
    }

    function register_object(object, mass, collision_box_mesh = null) {
        const position = object.get_position();
        const rotation = object.get_rotation();
        const scaling  = object.get_scaling();

        const mesh = collision_box_mesh !== null ?  collision_box_mesh : object.mesh;

        // Compute the center of mass from the vertices
        const center_of_mass = computeMeshCenterOfMass(mesh);
        const com = new Ammo.btVector3( // Center of mass in bullet vector...
            center_of_mass[0],
            center_of_mass[1],
            center_of_mass[2]
        );

        // Origin from GL world with an offset for center of mass
        const orig = new Ammo.btVector3(position[0], position[1], position[2]);
        orig.op_add(com);

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(orig);
        transform.setRotation(new Ammo.btQuaternion(
            rotation[0], rotation[1], rotation[2], rotation[3]
        ));

        const motion_state = new Ammo.btDefaultMotionState(transform);

        // Create object shape from mesh
        const obj_shape = createShapeFromObject(mesh, com);
        obj_shape.setLocalScaling(new Ammo.btVector3(scaling[0], scaling[1], scaling[2]));
        //obj_shape.setMargin(0.05);

        // Create the object with a mass of 1.0
        const rb_info = new Ammo.btRigidBodyConstructionInfo(1.0, motion_state, obj_shape);
        const body = new Ammo.btRigidBody(rb_info);
        body.setSleepingThresholds(0, 0);
        body.orig_object = object;
        body.com = com;     // Store the computed center of mass in the physics body

        // Add this rigid body to the object, bodies list and physics world
        object.set_physics_body(body);
        rigid_bodies.push(object);
        physicsWorld.addRigidBody(body);

        // Define the set_mass function for the physics body
        function set_mass(m) {
            const inertia = new Ammo.btVector3(0.0, 0.0, 0.0);
            body.getCollisionShape().calculateLocalInertia(m, inertia);
            body.setMassProps(m, inertia);
            body.local_inertia = inertia;
        }
        function apply_force_impulse(force_vect, force_pos, dt) {
            // Compute the torque
            const torque = glMatrix.vec3.create();
            glMatrix.vec3.cross(torque, force_pos, force_vect);

            // Get the local inertia
            const local_inertia = body.local_inertia;

            // Apply the velocities computed from force impulse
            body.setLinearVelocity(
                new Ammo.btVector3(force_vect[0] * dt, force_vect[1] * dt, force_vect[2] * dt)
            );
            body.setAngularVelocity(
                new Ammo.btVector3(
                    torque[0] / local_inertia.x() * dt,
                    torque[1] / local_inertia.y() * dt,
                    torque[2] / local_inertia.z() * dt
                )
            );
        }

        // Add some functions to the rigid body
        body.set_mass = set_mass;
        body.apply_force_impulse = apply_force_impulse;

        // Hack: we create the object with a mass of 1, then we set its actual mass
        body.set_mass(mass);

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
        run_picking: run_picking,
        set_time_acceleration: set_time_acceleration
    };
}