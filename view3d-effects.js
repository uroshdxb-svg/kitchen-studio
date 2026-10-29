/* Screen-space contact shading. Keep a direct-render path for WebGL 1. */
const KS3DEffects=(()=>{
  function create(renderer,scene,camera){
    if(!renderer.capabilities.isWebGL2)return null;
    const pass=new THREE.SSAOPass(scene,camera,1,1);
    // Both buffers need 24-bit depth. The default MSAA buffer uses 16 bits,
    // which makes close-fitting panels and clothing fight at overview distances.
    pass.normalRenderTarget.depthTexture.type=THREE.UnsignedIntType;
    pass.beautyRenderTarget.dispose();
    pass.beautyRenderTarget=new THREE.WebGLMultisampleRenderTarget(1,1,{format:THREE.RGBAFormat});
    pass.beautyRenderTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    pass.beautyRenderTarget.samples=4;pass.beautyRenderTarget.texture.encoding=THREE.sRGBEncoding;
    pass.ssaoMaterial.uniforms.tDiffuse.value=pass.beautyRenderTarget.texture;
    pass.kernelRadius=.12;pass.minDistance=.008/(camera.far-camera.near);pass.maxDistance=.15/(camera.far-camera.near);pass.renderToScreen=true;
    pass.ssaoMaterial.fragmentShader=pass.ssaoMaterial.fragmentShader.replace('1.0 - occlusion','1.0 - occlusion * 0.55');
    const visibility=pass.overrideVisibility.bind(pass);
    pass.overrideVisibility=()=>{visibility();scene.traverse(o=>{if(o.isMesh&&o.material?.transparent)o.visible=false;});};
    return {
      resize:(w,h)=>pass.setSize(w,h),
      render:()=>{const u=pass.ssaoMaterial.uniforms;u.cameraProjectionMatrix.value.copy(camera.projectionMatrix);u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);pass.render(renderer,null);},
      dispose:()=>{pass.dispose();pass.ssaoMaterial.dispose();pass.noiseTexture.dispose();}
    };
  }
  return {create};
})();
