const make_cubemap = async function (gl, cubemap_obj_file, cubemap_tex_dir, cubemap_tile_size) {
    const load_texture_cubemap = function (gl, folder_url, width = 512, height = 512) {
        const texture = gl.createTexture();

        // We need to specify the type of texture we are using.
        // This is useful for the SAMPLER in the shader.
        // It will allow us to sample a point in any direction and
        // not only in (s,t) coordinates.
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        const faceInfos = [
            {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                url: folder_url + '/posx.jpg',
            },
            {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                url: folder_url + '/negx.jpg',
            },
            {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                url: folder_url + '/posy.jpg',
            },
            {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                url: folder_url + '/negy.jpg',
            },
            {
                target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                url: folder_url + '/posz.jpg',
            },
            {
                target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
                url: folder_url + '/negz.jpg',
            },
        ];

        faceInfos.forEach((faceInfo) => {
            const {target, url} = faceInfo;

            // Upload the canvas to the cubemap face.
            // Setup each face so it's immediately renderable.
            const level = 0;
            const internalFormat = gl.RGBA;
            const format = gl.RGBA;
            const type = gl.UNSIGNED_BYTE;
            gl.texImage2D(target, level, internalFormat, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

            // Asynchronously load an image
            const image = new Image();
            image.src = url;
            image.addEventListener('load', function () {
                // Now that the image has loaded upload it to the texture.
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.texImage2D(target, level, internalFormat, format, type, image);
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            });
        });
        // Mipmapping for anti aliasing when we are far away from the texture
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        return texture;
    };

    function activate_texture(shader) {
        // Cubemap texture uniform
        const u_cubemap = gl.getUniformLocation(shader.program, 'u_cubemap');

        // Activate the texture for the cube (texture 10)
        gl.activeTexture(gl.TEXTURE10)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap_tex);
        gl.uniform1i(u_cubemap, 10);
    }

    function activate(shader) {
        // The depth buffer will be set to 1.0 everywhere due to the cubemap shader.
        // We need to change the depth testing function to ensure that the cubemap
        // passes the depth test (gl.LEQUAL: <= ).
        gl.depthFunc(gl.LEQUAL);

        activate_texture(shader);
        cubemap_mesh.draw(shader);

        // Set back the depth function for next frame
        gl.depthFunc(gl.LESS);
    }

    const cubemap_obj = await load_obj(cubemap_obj_file);
    const cubemap_mesh = await make_object(gl, cubemap_obj);
    const cubemap_tex = load_texture_cubemap(gl, cubemap_tex_dir, cubemap_tile_size, cubemap_tile_size);

    return {
        activate: activate,
        activate_texture: activate_texture,
        texture: cubemap_tex
    }
}