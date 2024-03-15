(function() {
    var self = window.CubicBezier = function(coordinates) {
        if (typeof coordinates === 'string') {
            if (coordinates.indexOf('#') === 0) {
                coordinates = coordinates.slice(1);
            }
            this.coordinates = coordinates.split(',');
        } else {
            this.coordinates = coordinates;
        }

        if (!this.coordinates) {
            throw 'No offsets were defined';
        }

        this.coordinates = this.coordinates.map(function(n) { return +n; });

        for (var i = 4; i--;) {
            var xy = this.coordinates[i];
            if (isNaN(xy) || (!(i % 2) && (xy < 0 || xy > 1))) {
                throw 'Wrong coordinate at ' + i + '(' + xy + ')';
            }
        }

        this.coordinates.toString = function() {
            return this.map(self.prettifyNumber) + '';
        }
    };

    self.prototype = {
        get P1() {
            return this.coordinates.slice(0, 2);
        },

        get P2() {
            return this.coordinates.slice(2);
        },

        // Clipped to the range 0-1
        get clipped() {
            var coordinates = this.coordinates.slice();

            for (var i = coordinates.length; i--;) {
                coordinates[i] = Math.max(0, Math.min(coordinates[i], 1));
            }

            return new self(coordinates);
        },

        get inRange() {
            var coordinates = this.coordinates;
            return Math.abs(coordinates[1] - .5) <= .5 && Math.abs(coordinates[3] - .5) <= .5;
        },

        toString: function() {
            return 'cubic-bezier(' + this.coordinates + ')';
        },

        applyStyle: function(element) {
            element.style.setProperty(prefix + 'transition-timing-function', this, null);
        },
    };

    Chainvas.extend(self, {
        prettifyNumber: function(val) {
            return (Math.round(val * 100) / 100 + '').replace(/^0\./, '.');
        },
    });
})();

(function() {
    var self = window.BezierCanvas = function(canvas, bezier, padding) {
        this.canvas = canvas;
        this.bezier = bezier;
        this.padding = self.getPadding(padding);

        // Convert to a cartesian coordinate system with axes from 0 to 1
        var ctx = this.canvas.getContext('2d'),
            p = this.padding;

        ctx.scale(canvas.width * (1 - p[1] - p[3]), -canvas.height * (1 - p[0] - p[2]));
        ctx.translate(p[3] / (1 - p[1] - p[3]), -1 - p[0] / (1 - p[0] - p[2]));
    };

    self.prototype = {
        get offsets() {
            var p = this.padding,
                w = this.canvas.width,
                h = this.canvas.height;

            return [{
                    left: w * (this.bezier.coordinates[0] * (1 - p[3] - p[1]) - p[3]) + 'px',
                    top: h * (1 - this.bezier.coordinates[1] * (1 - p[0] - p[2]) - p[0]) + 'px'
                },
                {
                    left: w * (this.bezier.coordinates[2] * (1 - p[3] - p[1]) - p[3]) + 'px',
                    top: h * (1 - this.bezier.coordinates[3] * (1 - p[0] - p[2]) - p[0]) + 'px'
                }
            ]
        },

        offsetsToCoordinates: function(element) {
            var p = this.padding,
                w = this.canvas.width,
                h = this.canvas.height;

            // Convert padding percentage to actual padding
            p = p.map(function(a, i) {
                return a * (i % 2 ? w : h)
            });

            return [
                (parseInt(element.style.left) - p[3]) / (w + p[1] + p[3]),
                (h - parseInt(element.style.top) - p[2]) / (h - p[0] - p[2])
            ];
        },

        plot: function(settings) {
            var xy = this.bezier.coordinates,
                ctx = this.canvas.getContext('2d');

            var defaultSettings = {
                handleColor: 'rgba(0,0,0,.6)',
                handleThickness: .008,
                bezierColor: 'black',
                bezierThickness: .02
            };

            settings || (settings = {});

            for (var setting in defaultSettings) {
                (setting in settings) || (settings[setting] = defaultSettings[setting]);
            }

            ctx.clearRect(-.5, -.5, 2, 2);

            // Draw control handles
            ctx.beginPath().prop({
                fillStyle: settings.handleColor,
                lineWidth: settings.handleThickness,
                strokeStyle: settings.handleColor
            });

            ctx.moveTo(0, 0).lineTo(xy[0], xy[1]);
            ctx.moveTo(1, 1).lineTo(xy[2], xy[3]);

            ctx.stroke().closePath();

            ctx.circle(xy[0], xy[1], 1.5 * settings.handleThickness).fill()
                .circle(xy[2], xy[3], 1.5 * settings.handleThickness).fill();

            // Draw bezier curve
            ctx.beginPath()
                .prop({
                    lineWidth: settings.bezierThickness,
                    strokeStyle: settings.bezierColor
                }).moveTo(0, 0)
                .bezierCurveTo(xy[0], xy[1], xy[2], xy[3], 1, 1).stroke()
                .closePath();
        }
    };

    self.getPadding = function(padding) {
        var p = typeof padding === 'number' ? [padding] : padding;

        if (p.length === 1) {
            p[1] = p[0];
        }

        if (p.length === 2) {
            p[2] = p[0];
        }

        if (p.length === 3) {
            p[3] = p[1];
        }

        return p;
    }
})();

(function() {
    var self = window.bezierLibrary = {
        curves: {},
        predefinedCurves: {
            'ease': '.25,.1,.25,1',
            'linear': '0,0,1,1',
            'ease-in': '.42,0,1,1',
            'ease-out': '0,0,.58,1',
            'ease-in-out': '.42,0,.58,1'
        },
        render: function() {
            var items = library.querySelectorAll('a');
            for (var i = 0; i < items.length; i++) {
                library.removeChild(items[i]);
            }
            for (var name in self.curves) {
                try {
                    var bezier = self.curves[name];
                    self.add(name, bezier);
                } catch (e) {
                    console.error("Error rendering curve:", e);
                    continue;
                }
            }
        },

        add: function(name, bezier) {
            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');


            var a = document.createElement('a');
            a.href = '#' + (bezier.coordinates || '');
            a.bezier = bezier;
            a.bezierCanvas = new BezierCanvas(canvas, bezier, 0.15);
            a.addEventListener('click', function() {
                // Appliquer la courbe sélectionnée
            });

            var span = document.createElement('span');
            span.textContent = name;
            span.title = name;

            // Ajouter le canvas avec la courbe dessinée dans le carré canvas
            a.appendChild(canvas);
            a.appendChild(span);
            library.insertBefore(a, document.querySelector('footer', library));
        },

        selectThumbnail: function() {
            var selected = document.querySelector('.selected', this.parentNode);
            if (selected) {
                selected.classList.remove('selected');
                selected.bezierCanvas.plot(self.thumbnailStyle);
            }
            this.classList.add('selected');
            this.bezierCanvas.plot(self.thumbnailStyleSelected);
            compare.style.cssText = this.style.cssText;
            compare.style.setProperty(prefix + 'transition-duration', getDuration() + 's', null);
            compareCanvas.bezier = this.bezier;

        },
        save: function(curves) {
            self.curves = self.predefinedCurves;
        },

    };

    // Ajout des courbes pré-définies
    Chainvas.extend(self, {
        prettifyNumber: function(val) {
            return (Math.round(val * 100) / 100 + '').replace(/^0\./, '.');
        },

        predefined: {
            'ease': '.25,.1,.25,1',
            'linear': '0,0,1,1',
            'ease-in': '.42,0,1,1',
            'ease-out': '0,0,.58,1',
            'ease-in-out': '.42,0,.58,1'
        }
    });

    /**
     * Init
     */

    // Ensure global vars for ids (most browsers already do this anyway, so…)
    [
        'values', 'curve', 'P1', 'P2', 'current', 'compare', 'duration',
        'library', 'save', 'copy', 'copyoptionstoggle', 'copybuttons', 'copyoptions', 'copystatement', 'copycss', 'copyvalue', 'go', 'import', 'export', 'json', 'importexport'
    ].forEach(function(id) { window[id] = $('#' + id); });

    var ctx = curve.getContext("2d"),
        bezierCode = $('h1 code'),
        curveBoundingBox = curve.getBoundingClientRect(),
        bezierCanvas = new BezierCanvas(curve, null, [.25, 0]),
        currentCanvas = new BezierCanvas(current, null, .15),
        compareCanvas = new BezierCanvas(compare, null, .15),
        pixelDepth = window.devicePixelRatio || 1;

    // Add predefined curves
    bezierLibrary.save(); // Utilisation de la méthode save pour charger les courbes prédéfinies

    bezierLibrary.render();

    if (location.hash) {
        bezierCanvas.bezier = window.bezier = new CubicBezier(decodeURI(location.hash));

        var offsets = bezierCanvas.offsets;

        P1.style.prop(offsets[0]);
        P2.style.prop(offsets[1]);
    }


    update();
    updateDelayed();

    /**
     * Event handlers
     */
    // Make the handles draggable
    P1.onmousedown =
        P2.onmousedown = function() {
            var me = this;

            document.onmousemove = function drag(e) {
                var x = e.pageX,
                    y = e.pageY,
                    left = curveBoundingBox.left,
                    top = curveBoundingBox.top;

                if (x === 0 && y == 0) {
                    return;
                }

                // Constrain x
                x = Math.min(Math.max(left, x), left + curveBoundingBox.width);

                me.style.prop({
                    left: x - left + 'px',
                    top: y - top + 'px'
                });

                update();
            };

            document.onmouseup = function() {
                me.focus();

                document.onmousemove = document.onmouseup = null;
            }
        };

    P1.onkeydown =
        P2.onkeydown = function(evt) {
            var code = evt.keyCode;

            if (code >= 37 && code <= 40) {
                evt.preventDefault();

                // Arrow keys pressed
                var left = parseInt(this.style.left),
                    top = parseInt(this.style.top)
                    offset = 3 * (evt.shiftKey ? 10 : 1);

                switch (code) {
                    case 37:
                        this.style.left = left - offset + 'px';
                        break;
                    case 38:
                        this.style.top = top - offset + 'px';
                        break;
                    case 39:
                        this.style.left = left + offset + 'px';
                        break;
                    case 40:
                        this.style.top = top + offset + 'px';
                        break;
                }

                update();
                updateDelayed();

                return false;
            }
        };

    P1.onblur =
        P2.onblur =
        P1.onmouseup =
        P2.onmouseup = updateDelayed;

    curve.onclick = function(evt) {
        var left = curveBoundingBox.left,
            top = curveBoundingBox.top,
            x = evt.pageX - left,
            y = evt.pageY - top;

        // Find which point is closer
        var distP1 = distance(x, y, parseInt(P1.style.left), parseInt(P1.style.top)),
            distP2 = distance(x, y, parseInt(P2.style.left), parseInt(P2.style.top));

        (distP1 < distP2 ? P1 : P2).style.prop({
            left: x + 'px',
            top: y + 'px'
        });

        update();
        updateDelayed();

        function distance(x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        }
    };

    curve.onmousemove = function(evt) {
        var left = curveBoundingBox.left,
            top = curveBoundingBox.top,
            height = curveBoundingBox.height,
            x = evt.pageX - left,
            y = evt.pageY - top;

        this.parentNode.setAttribute('data-time', Math.round(100 * x / curveBoundingBox.width));
        this.parentNode.setAttribute('data-progression', Math.round(100 * (3 * height / 4 - y) / (height * .5)));
    };


    go.onclick = function() {
        updateDelayed();

        current.classList.toggle('move');
        compare.classList.toggle('move');
    };



    /**
     * Helper functions
     */

    function getDuration() {
        return (isNaN(val = Math.round(duration.value * 10) / 10)) ? null : val;
    }

    function update() {
        // Redraw canvas
        bezierCanvas.bezier =
            currentCanvas.bezier =
            window.bezier = new CubicBezier(
                bezierCanvas.offsetsToCoordinates(P1)
                .concat(bezierCanvas.offsetsToCoordinates(P2))
            );

        bezierCanvas.plot();



        var params = $$('.param', bezierCode),
            prettyOffsets = bezier.coordinates.toString().split(',');

        for (var i = params.length; i--;) {
            params[i].textContent = prettyOffsets[i];
        }
    }


    // For actions that can wait
    function updateDelayed() {
        bezier.applyStyle(current);

        var hash = '#' + bezier.coordinates,
            size = 16 * pixelDepth;



        if (history.pushState) {
            history.pushState(null, null, hash);
        } else {
            location.hash = hash;
        }
    }
})();
