/**
    GoPro FIT
    Copyright (C) 2014  Lucas Teske

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
**/
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
if (window.File && window.FileReader && window.FileList && window.Blob) {
  // Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}

var container, stats;
var controls;
var camera, scene, renderer;
var glctx;

var density = [40,40];
var offsetz = -40;
var zscale = 18;
var imageAspect = 1;
var brightness = 0;
var contrast = 0;
var hue = 0;
var saturation = 0;
var voffset = 0;
var vdarkness = 0;
var object;
var composer;

var brightnessShader;
var contrastShader;
var huesaturationShader;
var vignetteShader;

$( document ).ready(function() {
	init();
	InitHandlers();
	InitDropOver();		
	animate();
});

function RenderHighRes()	{
	var vrenderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true, antialias: true});
	var width = object.material.map.image.naturalWidth;
	var height = object.material.map.image.naturalHeight;
	vrenderer.setSize( width, height  );

	var vcamera = new THREE.PerspectiveCamera( 45, width/height, 1, 1000 );
	vcamera.position.z = 400;
	var vscene = new THREE.Scene();
	vscene.add( new THREE.AmbientLight( 0xFFFFFF ) );
	
	// Post Process
	var vcomposer = new THREE.EffectComposer( vrenderer );
	vcomposer.addPass( new THREE.RenderPass( vscene, vcamera ) );

	var vbrightnessShader = new THREE.ShaderPass( THREE.BrightnessContrastShader );
	vcomposer.addPass( vbrightnessShader );

	var vvignetteShader = new THREE.ShaderPass( THREE.VignetteShader );  
	vcomposer.addPass( vvignetteShader );



	var vhuesaturationShader = new THREE.ShaderPass( THREE.HueSaturationShader );
	vcomposer.addPass( vhuesaturationShader );

	var vFXAAShader = new THREE.ShaderPass( THREE.FXAAShader );  
	vFXAAShader.renderToScreen = true;
	vFXAAShader.uniforms['resolution'].value.set(1 / width, 1 / height);
	vcomposer.addPass( vFXAAShader );

	vbrightnessShader.uniforms[ 'brightness' ].value = brightness / 100;
	vbrightnessShader.uniforms[ 'contrast' ].value = contrast / 100;
	vhuesaturationShader.uniforms[ 'hue' ].value = hue / 100;
	vhuesaturationShader.uniforms[ 'saturation' ].value = saturation / 100;
	vvignetteShader.uniforms[ 'offset' ].value = voffset;
	vvignetteShader.uniforms[ 'darkness' ].value = vdarkness;

	console.log("Set map to load");
	var map = THREE.ImageUtils.loadTexture( object.material.map.image.src , new THREE.UVMapping(), function()	{
		console.log("Map loaded!");
		console.log("Creating geometry");
		density[0] *= 2;
		density[1] *= 2;
		var imageAspect = map.image.naturalWidth / map.image.naturalHeight;
		var vobject = new THREE.Mesh( new THREE.PlaneGeometry(300*imageAspect, 300, density[0], density[1]), material  );
		vobject.position.set( 0, 0, 0 );
		vobject.overdraw = true;
	
		console.log("Adjusting perspective");
		vobject.geometry.dynamic = true;
		for(var y=0;y<density[1]+1;y++)	{
			for(var x=0;x<density[0]+1;x++)	{
				var p = y * (density[1]+1) + x;
				var rx = ((x/(density[0]))-0.5) * zscale*imageAspect;
				var ry = ((y/(density[1]))-0.5) * zscale;
				vobject.geometry.vertices[p].z = rx*rx + ry*ry + offsetz ;
			}
		}
		vscene.add( vobject );
		vcamera.lookAt( vobject.position );

		console.log("Rendering");
		vcomposer.render();	
		density[0] /= 2;
		density[1] /= 2;
		console.log("Rendered! Exporting");
		var URL = vcomposer.renderer.domElement.toDataURL("image/jpeg");
		console.log("Exported! Opening");
		var blob = dataURItoBlob(URL);
		var burl = window.URL.createObjectURL(blob);
		window.open(burl);

	});

	//map.anisotropy = 16;
	map.magFilter = THREE.Linear;
	map.minFilter = THREE.Linear;
	var material = new THREE.MeshBasicMaterial( { ambient: 0xFFFFFF, map : map, side: THREE.DoubleSide,shading: THREE.FlatShading  } );


}

function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type:mimeString});
}

function init() {
	glctx = document.getElementById('glctx');

	camera = new THREE.PerspectiveCamera( 45, parseInt(glctx.style.width)/parseInt(glctx.style.height), 1, 2000 );
	camera.position.z = 400;
	scene = new THREE.Scene();

	scene.add( new THREE.AmbientLight( 0xFFFFFF ) );

	var map = THREE.ImageUtils.loadTexture( 'G0018751.JPG' , new THREE.UVMapping(), function()	{
		console.log("Width: ",map.image.naturalWidth);
		console.log("Height: ",map.image.naturalHeight);
		imageAspect = map.image.naturalWidth / map.image.naturalHeight;
		console.log("Aspect Ratio: ",imageAspect);

		object = new THREE.Mesh( new THREE.PlaneGeometry(300*imageAspect, 300, density[0], density[1]), material );
		object.position.set( 0, 0, 0 );
		object.overdraw = true;

		object.geometry.dynamic = true;
		for(var y=0;y<density[1]+1;y++)	{
			for(var x=0;x<density[0]+1;x++)	{
				var p = y * (density[1]+1) + x;
				var rx = ((x/(density[0]))-0.5) * zscale*imageAspect;
				var ry = ((y/(density[1]))-0.5) * zscale;
				//console.log(rx);
				object.geometry.vertices[p].z = rx*rx + ry*ry + offsetz ;
			}
		}

		scene.add( object );
		camera.lookAt( object.position );
	});
	//map.wrapS = map.wrapT = THREE.RepeatWrapping;
	map.anisotropy = 16;
	map.magFilter = THREE.NearestFilter;
	map.minFilter = THREE.LinearMipMapLinearFilter;

	var material = new THREE.MeshBasicMaterial( { ambient: 0xFFFFFF, map: map, side: THREE.DoubleSide,shading: THREE.FlatShading } );


	renderer = new THREE.WebGLRenderer( { antialias: true , alpha: true} );
	renderer.setSize( parseInt(glctx.style.width),parseInt(glctx.style.height) );

	glctx.appendChild( renderer.domElement );

	// Post Process
	composer = new THREE.EffectComposer( renderer );
	composer.addPass( new THREE.RenderPass( scene, camera ) );

	brightnessShader = new THREE.ShaderPass( THREE.BrightnessContrastShader );
	brightnessShader.uniforms[ 'brightness' ].value = 0;
	brightnessShader.uniforms[ 'contrast' ].value = 0;
	//brightnessShader.renderToScreen = true;
	composer.addPass( brightnessShader );

	vignetteShader = new THREE.ShaderPass( THREE.VignetteShader );  
	vignetteShader.uniforms[ 'offset' ].value = 0;
	vignetteShader.uniforms[ 'darkness' ].value = 0;
	composer.addPass( vignetteShader );


	huesaturationShader = new THREE.ShaderPass( THREE.HueSaturationShader );
	huesaturationShader.uniforms[ 'hue' ].value = 0;
	huesaturationShader.uniforms[ 'saturation' ].value = 0;
	huesaturationShader.renderToScreen = true;
	composer.addPass( huesaturationShader );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.right = '0px';
	document.body.appendChild(stats.domElement);

	//	Trackball
	controls = new THREE.TrackballControls( camera, glctx );

	controls.rotateSpeed = 1.0;
	controls.zoomSpeed = 1.2;
	controls.panSpeed = 0.8;

	controls.noZoom = false;
	controls.noPan = false;

	controls.staticMoving = true;
	controls.dynamicDampingFactor = 0.3;

	controls.keys = [ 65, 83, 68 ];


}

function InitDropOver()	{
	var dropZone = document.getElementById('drop_zone');
	dropZone.addEventListener('dragover', handleDragOver, false);
	dropZone.addEventListener('drop', handleFileSelect, false);
}

function InitHandlers()	{
	$("#resettrack").click(function()	{
		controls.reset();
	});
	$("#renderhighres").click(function()	{
		RenderHighRes();
	});

	$('.slider').slider();
	$("#zoffset").slider('setValue', offsetz.toFixed(0));
	$("#zscale").slider('setValue', zscale.toFixed(1));
	$("#brightness").slider('setValue', contrast.toFixed(0));
	$("#contrast").slider('setValue', contrast.toFixed(0));
	$("#hue").slider('setValue', hue.toFixed(0));
	$("#saturation").slider('setValue', saturation.toFixed(0));

	$("#voffset").slider('setValue', hue.toFixed(2));
	$("#vdarkness").slider('setValue', saturation.toFixed(2));

	$("#zscale").bind('slide',function()	{
		zscale = parseFloat($("#zscale").val());
		if(isNaN(zscale))
			zscale = 18;
		$("#zscaleval").val(zscale.toFixed(1));
		UpdateObject();
	});

	$("#zoffset").bind('slide',function()	{
		offsetz = parseFloat($("#zoffset").val());
		if(isNaN(offsetz))
			offsetz = -40;
		$("#zoffsetval").val(offsetz.toFixed(0));
		UpdateObject();
	});

	$("#brightness").bind('slide',function()	{
		brightness = parseFloat($("#brightness").val());
		if(isNaN(brightness))
			brightness = 0;
		$("#brightnessval").val(brightness.toFixed(0));
		UpdateEffects();
	});

	$("#contrast").bind('slide',function()	{
		contrast = parseFloat($("#contrast").val());
		if(isNaN(contrast))
			contrast = 0;
		$("#contrastval").val(contrast.toFixed(0));
		UpdateEffects();
	});

	$("#hue").bind('slide',function()	{
		hue = parseFloat($("#hue").val());
		if(isNaN(hue))
			hue = 0;
		$("#hueval").val(hue.toFixed(0));
		UpdateEffects();
	});

	$("#saturation").bind('slide',function()	{
		saturation = parseFloat($("#saturation").val());
		if(isNaN(saturation))
			saturation = 0;
		$("#saturationval").val(saturation.toFixed(0));
		UpdateEffects();
	});

	$("#voffset").bind('slide',function()	{
		voffset = parseFloat($("#voffset").val());
		if(isNaN(voffset))
			voffset = 0;
		$("#voffsetval").val(voffset.toFixed(2));
		UpdateEffects();
	});

	$("#vdarkness").bind('slide',function()	{
		vdarkness = parseFloat($("#vdarkness").val());
		if(isNaN(vdarkness))
			vdarkness = 0;
		$("#vdarknessval").val(vdarkness.toFixed(2));
		UpdateEffects();
	});
	$("#zoffsetval").change(function()	{
		offsetz = parseFloat($("#zoffsetval").val());
		if(isNaN(offsetz))
			offsetz = -40;
		if(offsetz > 350)
			offsetz = 350;
		if(offsetz < -500)
			offsetz = -500;
		$("#zoffset").slider('setValue', offsetz.toFixed(0));
		$("#zoffsetval").val(offsetz.toFixed(0));
		UpdateObject();
	});


	$("#zscaleval").change(function()	{
		zscale = parseFloat($("#zscaleval").val());
		if(isNaN(zscale))
			zscale = 18;
		if(offsetz > 50)
			zscale = 50;
		if(zscale < 0)
			zscale = 0;
		$("#zscale").slider('setValue', zscale.toFixed(1));
		$("#zscaleval").val(zscale.toFixed(1));
		UpdateObject();
	});

	$("#brightnessval").change(function()	{
		brightness = parseFloat($("#brightnessval").val());
		if(isNaN(brightness))
			brightness = 0;
		if(brightness > 100)
			brightness = 100;
		if(brightness < -100)
			brightness = -100;
		$("#brightness").slider('setValue', brightness.toFixed(0));
		$("#brightnessval").val(brightness.toFixed(0));
		UpdateEffects();
	});

	$("#contrastval").change(function()	{
		contrast = parseFloat($("#contrastval").val());
		if(isNaN(contrast))
			contrast = 0;
		if(contrast > 100)
			contrast = 100;
		if(contrast < -100)
			contrast = -100;
		$("#contrast").slider('setValue', contrast.toFixed(0));
		$("#contrastval").val(contrast.toFixed(0));
		UpdateEffects();
	});

	$("#hueval").change(function()	{
		hue = parseFloat($("#hueval").val());
		if(isNaN(hue))
			hue = 0;
		if(hue > 100)
			hue = 100;
		if(hue < -100)
			hue = -100;
		$("#hue").slider('setValue', hue.toFixed(0));
		$("#hueval").val(hue.toFixed(0));
		UpdateEffects();
	});
	$("#saturationval").change(function()	{
		saturation = parseFloat($("#saturationval").val());
		if(isNaN(saturation))
			saturation = 0;
		if(saturation > 100)
			saturation = 100;
		if(saturation < -100)
			saturation = -100;
		$("#saturation").slider('setValue', saturation.toFixed(0));
		$("#saturationval").val(saturation.toFixed(0));
		UpdateEffects();
	});

	$("#voffsetval").change(function()	{
		voffset = parseFloat($("#voffsetval").val());
		if(isNaN(voffset))
			voffset = 0;
		if(voffset > 5)
			voffset = 5;
		if(voffset < 0)
			voffset = 0;
		$("#voffset").slider('setValue', voffset.toFixed(2));
		$("#voffsetval").val(voffset.toFixed(2));
		UpdateEffects();
	});

	$("#vdarknessval").change(function()	{
		vdarkness = parseFloat($("#vdarknessval").val());
		if(isNaN(vdarkness))
			vdarkness = 0;
		if(vdarkness > 5)
			vdarkness = 5;
		if(vdarkness < 0)
			vdarkness = 0;
		$("#vdarkness").slider('setValue', vdarkness.toFixed(2));
		$("#vdarknessval").val(vdarkness.toFixed(2));
		UpdateEffects();
	});
}

function UpdateObject()	{
	if(object != undefined)	{
		object.geometry.dynamic = true;
		for(var y=0;y<density[1]+1;y++)	{
			for(var x=0;x<density[0]+1;x++)	{
				var p = y * (density[1]+1) + x;
				var rx = ((x/(density[0]))-0.5) * zscale*imageAspect;
				var ry = ((y/(density[1]))-0.5) * zscale;
				object.geometry.vertices[p].z = rx*rx + ry*ry + offsetz ;
			}
		}
		object.geometry.verticesNeedUpdate = true;
	}
}

function UpdateEffects()	{
	brightnessShader.uniforms[ 'brightness' ].value = brightness / 100;
	brightnessShader.uniforms[ 'contrast' ].value = contrast / 100;
	huesaturationShader.uniforms[ 'hue' ].value = hue / 100;
	huesaturationShader.uniforms[ 'saturation' ].value = saturation / 100;
	vignetteShader.uniforms[ 'offset' ].value = voffset;
	vignetteShader.uniforms[ 'darkness' ].value = vdarkness;
}

function animate() {
	requestAnimationFrame( animate );
	//renderer.render( scene, camera );
	composer.render();
	stats.update();
	controls.update();
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}
function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

	var files = evt.dataTransfer.files; // FileList object.
    for (var i = 0, f; f = files[i]; i++) {
        var reader = new FileReader();
        if(f.type.match("image.*"))	{
			reader.onload = function(e) {
				var dataURL = reader.result;
				$("#drop_zone").html("<center><img class=\"dropimage\"  src=\""+dataURL+"\"/></center>");
				object.material.map = THREE.ImageUtils.loadTexture( dataURL ,new THREE.UVMapping(), function()	{
					console.log("Width: ",object.material.map.image.naturalWidth);
					console.log("Height: ",object.material.map.image.naturalHeight);
					imageAspect = object.material.map.image.naturalWidth / object.material.map.image.naturalHeight;
					console.log("Aspect Ratio: ",imageAspect);
					object.geometry.dynamic = true;
					for(var y=0;y<density[1]+1;y++)	{
						for(var x=0;x<density[0]+1;x++)	{
							var p = y * (density[1]+1) + x;
							var rx = ((x/(density[0]))-0.5) * zscale*imageAspect;
							var ry = ((y/(density[1]))-0.5) * zscale;
							//console.log(rx);
							object.geometry.vertices[p].z = rx*rx + ry*ry + offsetz ;
						}
					}
				});

				object.material.needsUpdate = true;
			}
			reader.readAsDataURL(f);
        }
    }
}	