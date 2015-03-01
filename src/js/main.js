function timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
}

// takes wavelength in nm and returns an rgba value
function wavelengthToColor(wavelength) {
    var R,
        G,
        B,
        alpha,
        colorSpace,
        wl = wavelength,
        gamma = 1;


    if (wl >= 380 && wl < 440) {
        R = -1 * (wl - 440) / (440 - 380);
        G = 0;
        B = 1;
    } else if (wl >= 440 && wl < 490) {
        R = 0;
        G = (wl - 440) / (490 - 440);
        B = 1;
    } else if (wl >= 490 && wl < 510) {
        R = 0;
        G = 1;
        B = -1 * (wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        R = (wl - 510) / (580 - 510);
        G = 1;
        B = 0;
    } else if (wl >= 580 && wl < 645) {
        R = 1;
        G = -1 * (wl - 645) / (645 - 580);
        B = 0.0;
    } else if (wl >= 645 && wl <= 780) {
        R = 1;
        G = 0;
        B = 0;
    } else {
        R = 0;
        G = 0;
        B = 0;
    }

    // intensty is lower at the edges of the visible spectrum.
    if (wl > 780 || wl < 380) {
        alpha = 0;
    } else if (wl > 700) {
        alpha = (780 - wl) / (780 - 700);
    } else if (wl < 420) {
        alpha = (wl - 380) / (420 - 380);
    } else {
        alpha = 1;
    }

    colorSpace = ["rgba(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%, " + alpha + ")", R, G, B, alpha]

    // colorSpace is an array with 5 elements.
    // The first element is the complete code as a string.
    // Use colorSpace[0] as is to display the desired color.
    // use the last four elements alone or together to access each of the individual r, g, b and a channels.

    return colorSpace;
}

var PI_180 = Math.PI / 180;
var PIx2 = Math.PI * 2;
var HALF_PI = Math.PI / 2;

var Wave = (function () {
    function Wave(waveLength, phase, amplitude, velocity) {
        this.waveLength = waveLength;
        this.phase = phase;
        this.amplitude = amplitude;
        this.velocity = velocity;

        this.freguency = this.velocity / this.waveLength; // PIx2 * this.velocity;
        this.timePeriod = 1/this.freguency;
    }

    Wave.prototype.value = function (z, t) {
        var x = -(t * this.velocity) + (-z * PIx2) / this.waveLength;

        var y = Math.sin(x);

        return {
            x: z,
            y: this.amplitude * y
        };
    };

    return Wave;
})();

var WaveAdder = (function () {
    function WaveAdder(waves){
        this.waves = waves;

        Object.defineProperty(this, "amplitude", {
            get : function () {
                var amplitude = 0;
                for(var waveIdx = 0; waveIdx < this.waves.length; waveIdx++)
                    amplitude += waves[waveIdx].amplitude;
                return amplitude;
            }
        });
    }

    WaveAdder.prototype.value = function(z, t){
        var position = {x: z, y: 0};

        for(var i in this.waves){
            var wave_position = this.waves[i].value(z, t);
            position.y += wave_position.y;
        }

        //position.y = Math.abs(position.y)
        return position;
    };

    return WaveAdder;
})();


var WaveRenderer = (function () {
    function WaveRenderer(waves, wavesInfo){
        this.waves = waves;
        this.wavesInfo = wavesInfo;
    }

    WaveRenderer.prototype.render = function(context, clock){
        context.save();

        for(var waveIdx = 0; waveIdx < this.waves.length; waveIdx++){
            var wave = this.waves[waveIdx];
            var waveInfo = this.wavesInfo[waveIdx];

            context.save();

            context.translate(waveInfo.x, waveInfo.y);

            context.lineWidth = 1;
            context.lineCap = 'butt';
            context.lineJoin = 'round';

            var gradient = context.createLinearGradient(0, 0, waveInfo.width, 0);
            gradient.addColorStop(0,'rgba('+waveInfo.color[0]+', '+waveInfo.color[1]+', '+waveInfo.color[2]+', 1)');
            gradient.addColorStop(0.8,'rgba('+waveInfo.color[0]+', '+waveInfo.color[1]+', '+waveInfo.color[2]+', 1)');
            gradient.addColorStop(1,'rgba('+waveInfo.color[0]+', '+waveInfo.color[1]+', '+waveInfo.color[2]+', 0)');

            context.strokeStyle = gradient;

            context.beginPath();
            for (var i = 0; i < waveInfo.width; i += 1) {
                var point = wave.value(i, clock.elapsed);

                if(i === 0)
                    context.moveTo(point.x, point.y);
                context.lineTo(point.x, point.y);
            }

            context.lineTo(wave.width, waveInfo.y);
            context.stroke();

            context.restore();
        }

        context.restore();
    };

    return WaveRenderer;
})();

var Game = (function () {
    function Game() {
        this.clock = {
            last_time: timestamp(),
            delta: 0,
            elapsed: 0
        };

        this.timeshift = 1;

        this.filmThickness = 5;
        this.filmAngle = 10;

        this.borderWidth = 100;
        this.waveLengthScale = 0.15;

        this.waves = [
            //       waveLength,                       phase, amplitude,                        velocity
            new Wave(700*this.waveLengthScale,         0,     700*this.waveLengthScale/2,        1),
            new Wave(700*this.waveLengthScale,         0,     700*this.waveLengthScale/2,       -1),
        ];
        this.waves.push(new WaveAdder([this.waves[0], this.waves[1]]));

        this.wavesInfo = [
            {x:-512, y: -80, width: 1024, color: [246, 81, 81]},
            {x:-512, y: 0,   width: 1024, color: [16, 123, 213]},
            {x:-512, y: 140, width: 1024, color: [131, 80, 193]},
        ];

        this.waveRenderer = new WaveRenderer(this.waves, this.wavesInfo);
    }

    Game.prototype.setWavelength = function (value){
        for (var i = 0; i < this.waves.length; i++){
            this.waves[i].waveLength = value*this.waveLengthScale;
            if (i != 2)
                this.waves[i].amplitude = this.waves[i].waveLength/2;
        }
    };

    Game.prototype.getWidthWithoutBorder = function(context){
        return context.canvas.width-2*this.borderWidth;
    };

    Game.prototype.update = function (context) {
        var now = timestamp();
        this.clock.delta = (now - this.clock.last_time) / 1000 * this.timeshift;    // duration in seconds
        this.clock.elapsed += this.clock.delta;

        // update all

        this.borderWidth = context.canvas.width/16;

        for(var i = 0; i < this.wavesInfo.length; i++){
            this.wavesInfo[i].width = this.getWidthWithoutBorder(context);
            this.wavesInfo[i].x = -this.getWidthWithoutBorder(context)/2;
            this.wavesInfo[i].y = -context.canvas.height/2 + context.canvas.height/4 + (context.canvas.height/4)*i;
        }

        // restore scale
        //for(var i = 0; i < this.waves.length-1; i++){
        //    this.waves[i].waveLength *= 1/this.waveLengthScale;
        //}

        // calculate new scale
        // apply scale

        this.clock.last_time = now;
    };

    Game.prototype.render = function (context) {
        var widthWithoutBorder = this.getWidthWithoutBorder(context);

        // light color
        context.save();
            context.fillStyle = wavelengthToColor(this.waves[0].waveLength*(1/this.waveLengthScale))[0];
            context.translate(-widthWithoutBorder/2, -context.canvas.height/2);
            context.fillRect(0, 0, 50, 50);
            context.strokeStyle = 'black';
            context.strokeRect(0, 0, 50, 50);
        context.restore();

        // light
        context.save();
            context.fillStyle = 'rgb(248, 193, 25)';
            context.fillRect(-context.canvas.width/2, -context.canvas.height/2, this.borderWidth, context.canvas.height);

            context.fillStyle = 'rgb(255, 255, 255)';
            context.font = this.borderWidth/2+'px futura-pt';
            context.textAlign = "center";
            var text = 'Light source';
            context.translate(-context.canvas.width/2+this.borderWidth/2+10, 0);
            context.rotate(PI_180*-90);
            context.fillText(text, 0, 0);
        context.restore();

        // mirror
        context.save();
            context.fillStyle = 'rgb(61, 170, 203)';
            context.fillRect(context.canvas.width/2 - this.borderWidth, -context.canvas.height/2, this.borderWidth, context.canvas.height);

            context.fillStyle = 'rgb(255, 255, 255)';
            context.font = this.borderWidth/2+'px futura-pt';
            context.textAlign = "center";
            var text = 'Perfect mirror';
            context.translate(context.canvas.width/2-this.borderWidth/2+10, 0);
            context.rotate(PI_180*-90);
            context.fillText(text, 0, 0);
        context.restore();

        // waves
        context.save();
            context.scale(-1, 1);
            this.waveRenderer.render(context, this.clock);
        context.restore();

        // lambda lines
        context.save();
            context.translate(widthWithoutBorder/2, 0);

            var lambda = this.waves[0].waveLength;
            var lines = 15;
            for (var i = 1; i < lines; i+=2){
                var x = i*lambda/4;
                // dotted line
                context.save();
                    context.beginPath();
                    context.strokeStyle = 'rgba(34, 34, 34,  '+(lines-i)/lines+')';
                    context.setLineDash([5]);
                    context.moveTo(-x, (-context.canvas.height/2)*0.8);
                    context.lineTo(-x, (context.canvas.height/2)*0.8);
                    context.stroke();
                context.restore();
                // title
                context.save();
                    context.translate(-x, context.canvas.height/2-context.canvas.height/16);
                    context.fillStyle = 'rgb(34, 34, 34)';
                    context.font = Math.round((lambda/4)*0.5)+'px futura-pt';
                    context.textAlign = "center";
                    context.fillText((i != 1 ? i : '') +  'λ/4', 0, 0);
                context.restore();
            }
        context.restore();

        // film mask
        context.save();
            context.translate(widthWithoutBorder/2-this.filmThickness, -context.canvas.height/2);
            context.transform(1, 0, -Math.tan(PI_180 * this.filmAngle), 1, 0, 0);

            context.beginPath();
            context.fillStyle = 'black';
            context.rect(0, context.canvas.height, this.filmThickness, -context.canvas.height);
        context.restore();

        context.clip();

        // film gradient
        context.save();
            context.translate(widthWithoutBorder/2, -context.canvas.height/2);
            context.scale(-1, 1);

            var gradientWidth = widthWithoutBorder;
            var gradient = context.createLinearGradient(0,0, gradientWidth,0);

            for (var i = 0; i < gradientWidth; i += 1) {
                var value = this.waves[2].value(i, this.clock.elapsed).y;
                value = Math.abs(Math.pow(value, 1));
                var color = Math.round((value/this.waves[2].amplitude) * 255);
                gradient.addColorStop(i/gradientWidth, 'rgba('+color+', '+color+', '+color+', 1)');
            }

            context.fillStyle=gradient;
            context.fillRect(0, 0, gradientWidth, context.canvas.height);
        context.restore();
    };

    return Game;
})();

var game;

$(function(){
    var stats = new Stats();
    stats.setMode(0); // 0: fps, 1: ms

    // align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';

    document.body.appendChild( stats.domElement );

    var canvas, context;

    var init = function (){
        canvas = document.getElementById('canvas');
        canvas.width = $(window).width();
        canvas.height = $(window).height();

        context = canvas.getContext("2d");

        game = new Game();

        window.addEventListener("resize", function(){
            canvas.width = $(window).width();
            canvas.height = $(window).height();
        });

        var gui = new dat.GUI();
        gui.add(game, 'timeshift').min(0).max(5);
        gui.add({wavelength: 700}, 'wavelength', 300, 700).onChange(function (value){
            game.setWavelength(value)
        });
        gui.add(game, 'filmAngle').min(0).max(45);
        gui.add(game, 'filmThickness').min(5).max(512);
    };

    var update = function () {
        stats.begin();
        context.save();

            context.clearRect(0, 0, canvas.width, canvas.width);
            context.fillStyle = 'rgb(255, 252, 245)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.translate(canvas.width/2, canvas.height/2);

            game.update(context);
            game.render(context);

        context.restore();
        stats.end();
        requestAnimationFrame( update );
    };

    init();
    requestAnimationFrame( update );
});
